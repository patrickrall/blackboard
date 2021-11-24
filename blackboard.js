


window.latexTmp = document.createElement("div")
window.latexTmp.style.display = "none"
document.body.appendChild(window.latexTmp)
window.latexCache = {}
window.latexRendering = false
function* cacheLatex(tex) {
    if (window.latexCache[tex] !== undefined) return

    while (window.latexRendering) yield* named_event("latex_render_complete") 
    
    window.latexRendering = true
    var options = MathJax.getMetricsFor(window.latexTmp)
    MathJax.tex2svgPromise(tex, options).then(function (node) {
        var svg = node.getElementsByTagName("svg")[0]
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
        svg.setAttribute("color", "white")
        var image = new Image()
        image.src = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(svg.outerHTML)))
        image.onload = function () {
            window.latexCache[tex] = image
            dispatch_event("latex_render_complete")
        }
        MathJax.startup.document.clear()
        MathJax.startup.document.updateDocument()
    })
    
    yield* named_event("latex_render_complete") 
    window.latexRendering = false
    compute_state()
    draw()
}


function* init() {


    document.title = "Whiteboard Application"

    window.message = document.createElement("p") 
    document.body.appendChild(window.message)

    window.message.innerText = "Connecting to PeerJS server..."


    var urlParams = new URLSearchParams(window.location.search);
    var target = undefined
    for (var key of urlParams.keys()) {
        target = key
        break
    }

    if (!target) {
        // try to be host, so pick a human readable id
        var key = window.words[Math.floor(Math.random()*window.words.length)]
        window.peer = new Peer(key,{"debug":2})
    } else {
        window.peer = new Peer(null,{"debug":2})
    }

    var [e, id] = yield* on_event(window.peer, 'open')
    peer.on('connection', connection);
    peer.on('error', function(e) {
        console.log("Error:",e.message)
    })
    window.id = id
    console.log("My id:", window.id)
    window.friendsConns = {}

    if (!target) {
        this.isHost = true
        window.history.pushState(null, "Whiteboard Application", "?"+window.id)

        console.log("I am the host.")
    } else {
        window.message.innerText = "Connecting to host '"+target+"'..."
        this.isHost = false

        var c = peer.connect(target, {reliable: true})
        connection(c)

        var es = yield* any({
            "open": on_event(c,"open"),
            "error": on_event(peer,"error"),
        })
        
        if (es.error) {
            window.message.innerHTML = "Failed to connect to host "+target+".<br/><a href='?'>Become host yourself.</a>"
            return
        }
        window.hostId = target
        
        console.log("I am a client.")
    }

    document.body.removeChild(window.message)

    window.canvas = document.createElement("canvas")
    document.body.appendChild(window.canvas)
 
    window.font = "25px sans-serif"
    window.latexScale = 1.8
    

    ///////////////////////////////////////////////// Data initialization
    
    // Data for drawing
    window.pos = {"x":0, "y":0}       // camera position
    window.summonpos = {"x":0, "y":0}
    window.strokes = []                     // list of strokes, each is [[x,y],[x,y],[x,y]]
    window.text = []       // {"x":x, "y":y, "text":"Hello world"}
    window.latex = []      // {"x":x, "y":y, "text":"1+1"}

    // not really for drawing, but for hit testing.
    window.text_rects = [] // {"x":x, "y":y, "w":w, "h":h, "t":<timestamp>, "text":"asdf"}  


    // Data for sync
    // same action objects, different tables for references
    window.action_list = [] // kept in order automatically (insert via binary search for example)
    window.action_hash = {} // indexed by timestamps

    // personal data
    window.mode = "stroke" // erase-split, erase-simple, move, text
    window.color = "white"
    window.colors = ["white","Crimson","Khaki","CornflowerBlue","LightGreen"] 
    window.selection = [] // [x,y,w,h]
    window.selected_text = false // if this is a timestamp, then dont draw the corresponding text


    // cursors
    window.cursor_actions = []
    
    ///////////////////////////////////////////////// Listeners

    launch(viewport_loop())
    launch(stroke_erase_loop())
    launch(pan_loop())
    launch(mode_loop())
    launch(key_mode_loop())
    launch(text_loop())
    launch(move_loop())
    launch(delete_loop())
    if (window.isHost) launch(saving_loop())


    window.cursorcolor = "hsl("+Math.floor(Math.random()*256)+", 100%, 52%)"
    launch(cursor_loop())
    launch(touch_loop())

    window.addEventListener("wheel",function(e) {
        window.pos.x += e.deltaX
        window.pos.y += e.deltaY
        window.summonpos.x = window.pos.x
        window.summonpos.y = window.pos.y
        draw()
    })
    
    // Im lazy and this is simple, so I'll put this here.
    window.addEventListener('mouseup', function (e) {
        if (e.which !== 3) return
        if (e.detail === 3) { 
            var [x,y] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]
            send_message({"type":"summon", "x":x, "y":y})
        }
    })


    /////////////////////////////////////////////////// Load data
   
    if (this.isHost) {
        var today = new Date()
        window.saveKey = today.getFullYear()+'/'+(today.getMonth()+1)+'/'+today.getDate()
        
        if (window.localStorage[window.saveKey] !== undefined) {
            send_message(JSON.parse(window.localStorage[window.saveKey]))
        }
    }

}


function connection(c) {
    c.on("open", function() {
        window.friendsConns[c.peer] = c
        c.send({"type":"friends", "friends":window.Object.keys(friendsConns)})
        console.log("Friends list:", Object.keys(window.friendsConns))
        if (window.isHost) {
            save_and_sync()
        }
    })
    c.on("data", function(data) {

        if (data["type"] == "friends") {
            for (var id of data.friends) {
                if (id == window.id) continue
                if (!(id in window.friendsConns)) {
                    var c = peer.connect(id, {reliable: true})
                    connection(c)
                }
            }
        } else {
            receive_message(data) 
        }
    })
    
    c.on("error", function(e) {
        console.log("Error:", e.message)
    })

    c.on("close", function() {
        delete window.friendsConns[c.peer]
        console.log("Friends list:", Object.keys(window.friendsConns))
        
        if (c.peer == window.hostId) {
            document.body.removeChild(window.canvas)
            document.body.appendChild(window.message)
            window.message.innerText = "Disconnected from host."
        }
    })
}




///////////////////////////////////////////////////////



function draw() {
    var ctx = window.canvas.getContext("2d")



    ctx.fillStyle = "black"
    ctx.setTransform(1,0,0,1,0,0)
    ctx.fillRect(0,0,window.canvas.width, window.canvas.height)

    ctx.setTransform(1,0,0,1, -window.pos.x, -window.pos.y)

    /////////////// Draw selection

    ctx.fillStyle = "#333"

    for (var rect of window.selection) {
        ctx.fillRect(rect[0],rect[1],rect[2],rect[3])
    }

    /////////////// Draw strokes

    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    for (var stroke of window.strokes) {
        ctx.strokeStyle = stroke["color"]
        ctx.beginPath()
        var start = true
        for (var [x,y] of stroke["points"]) {
            if (start) {
                start = false
                ctx.moveTo(x,y)
            } else {
                ctx.lineTo(x,y)
            }
        }
        ctx.stroke()
    }


    /////////////// Draw text and latex
       

    /*
    ctx.fillStyle = "red"
    for (var text_rect of window.text_rects) {
        ctx.fillRect(text_rect["x"],text_rect["y"],text_rect["w"],text_rect["h"])
    }
    */

    ctx.textBaseline = "bottom"
    ctx.fillStyle = "white"
    ctx.font = window.font 
    for (var text of window.text) {
        ctx.fillText(text["text"],text["x"],text["y"])
    }
    for (var latex of window.latex) {
        if (window.latexCache[latex["text"]] === undefined) continue
        var img = window.latexCache[latex["text"]]
        ctx.drawImage(img,latex["x"],latex["y"],img.width*window.latexScale,img.height*window.latexScale)
    }

    /////////// Cursor

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    var t0 = Date.now()
    var new_actions = []
    for (var action of window.cursor_actions) {

        var new_action = {
            "t": action["t"],
            "pts": [],
            "color":action["color"]
        }

        ctx.strokeStyle = action["color"]

        for (var i = 0; i < action["pts"].length-1; i++) {
            var dt = t0 - action["pts"][i][2]
            if (dt < 0) dt = 0
            if (dt > 900) continue
            new_action["pts"].push(action["pts"][i])

            ctx.lineWidth = 5*(1000 - dt)/1000
            ctx.beginPath()
            ctx.moveTo(action["pts"][i][0],action["pts"][i][1])
            ctx.lineTo(action["pts"][i+1][0],action["pts"][i+1][1])
            ctx.stroke()
        }
        var last_pt = action["pts"][action["pts"].length-1]
        if (t0 - last_pt[2] <= 900) new_action["pts"].push(last_pt)

        if (new_action.pts.length > 0) {
            new_actions.push(new_action)
        }
    }
    window.cursor_actions = new_actions
    // {"t":<timestamp>, "pts":[[x,y,t],[x,y,t]], "color":"#303030"}
   

    // animate

    var redraw_soon = window.cursor_actions.length > 0

    if (isNaN(window.summonpos.x)) window.summonpos.x = window.pos.x
    if (isNaN(window.summonpos.y)) window.summonpos.y = window.pos.y
    redraw_soon ||= window.summonpos.x != window.pos.x
    redraw_soon ||= window.summonpos.y != window.pos.y
    if (redraw_soon) {
        window.requestAnimationFrame(function(dt) {
            var dx = (window.summonpos.x - window.pos.x)
            var dy = (window.summonpos.y - window.pos.y)

            if (dx != 0 || dy != 0) {
                var dxfrac = Math.abs(dx) / (Math.abs(dx) + Math.abs(dy))
                var dyfrac = Math.abs(dy) / (Math.abs(dx) + Math.abs(dy))

                window.pos.x += Math.sign(dx) * Math.min(Math.abs(dx),dt*0.006*dxfrac)
                window.pos.y += Math.sign(dy) * Math.min(Math.abs(dy),dt*0.006*dyfrac)
            }
            draw()
        })
    }



    ////////////////// Draw menu
    
    ctx.textBaseline = "alphabetic"
    ctx.setTransform(1,0,0,1,0,0)
    ctx.fillStyle = "black"
    ctx.fillRect(0,window.canvas.height-30,200,30)
    ctx.lineWidth = 1
    ctx.lineCap = "square"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "white"
    ctx.beginPath()
    ctx.moveTo(0,window.canvas.height-30)
    ctx.lineTo(200,window.canvas.height-30)
    ctx.lineTo(200,window.canvas.height)
    ctx.stroke()


    ctx.fillStyle = "#444444"
    if (window.mode == "stroke") ctx.fillRect(3,window.canvas.height-25,47,20)
    if (window.mode == "erase_split") ctx.fillRect(53,window.canvas.height-25,49,20)
    if (window.mode == "erase_simple") {
        ctx.fillStyle = "#888888"
        ctx.fillRect(53,window.canvas.height-25,49,20)
    }
    if (window.mode == "text") ctx.fillRect(104,window.canvas.height-25,41,20)
    if (window.mode == "move_split") ctx.fillRect(148,window.canvas.height-25,47,20)
    if (window.mode == "move_simple") {
        ctx.fillStyle = "#888888"
        ctx.fillRect(148,window.canvas.height-25,47,20)
    }

    ctx.font = "16px sans"
    ctx.fillStyle = "white"
    ctx.fillText("Draw",5,window.canvas.height-9)
    ctx.fillText("Erase",55,window.canvas.height-9)
    ctx.fillText("Text",108,window.canvas.height-9)
    ctx.fillText("Move",150,window.canvas.height-9)

    // color swatches
   
    if (window.mode == "stroke") {

        ctx.fillStyle = "black"
        ctx.fillRect(0,window.canvas.height-60.,window.colors.length*30 + 10,30)
        ctx.lineWidth = 1
        ctx.lineCap = "square"
        ctx.lineJoin = "round"
        ctx.strokeStyle = "white"
        ctx.beginPath()
        ctx.moveTo(0,window.canvas.height-60)
        ctx.lineTo(window.colors.length*30 +10,window.canvas.height-60)
        ctx.lineTo(window.colors.length*30 +10,window.canvas.height-30)
        ctx.stroke()
        
        var x = 0
        for (var c of window.colors) {
            ctx.fillStyle = c
            ctx.beginPath()
            if (window.color == c) {
                ctx.arc(x + 20, window.canvas.height-45, 10, 0, 2 * Math.PI)
            } else {
                ctx.arc(x + 20, window.canvas.height-45, 6, 0, 2 * Math.PI)
            }

            ctx.fill()
            x += 30
        }
    }


    /*
    if (window.action_list.length == 0) return
    var t = window.action_list[window.action_list.length-1]["t"]
    if (Date.now() - t < 2000) return // wait at least two seconds
    if (window.action_list[window.action_list.length-1]["type"] == "state") return
    save_and_sync()
    */

}


function save_and_sync() {
    if (!this.isHost) return
    if (window.action_list.length == 0) {
        var t = Date.now()
    } else {
        var t = window.action_list[window.action_list.length-1]["t"] + 1
    }
    
    var msg = {
        "type":"state",
        "t": t,
        "strokes": [],
        "texts": [],
    }
        // {"t":<timestamp>, "type":"state", "strokes":[{"color":"#101010", "ps":[[x,y],[x,y]]}], "texts":[{"text":"hello world", "p":[x,y], "t":<timestamp>}] }
    
    for (var stroke of window.strokes) {
        msg["strokes"].push({"color":stroke["color"], "ps":stroke["points"]})
    }  

    for (var text_rect of window.text_rects) {
        msg["texts"].push({"text":text_rect["text"], "p":[text_rect["x"],text_rect["y"]], "t":text_rect["t"]})
    } 

    send_message(msg)
    if (msg["strokes"].length == 0 && msg["texts"].length == 0) {
        console.log("Cleared '"+window.saveKey+"'.")
        delete window.localStorage[window.saveKey]
    } else {
        console.log("Saved as '"+window.saveKey+"'.")
        window.localStorage[window.saveKey] = JSON.stringify(msg)
    }
}



