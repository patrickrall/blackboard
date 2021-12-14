
window.host_timeout = 1000
window.chunk_size = 100
window.zoom_base = 1.1
window.latexScale = 1.8
window.modes = ["point", "pan", "draw", "erase", "move", "text", "save", "load"]
window.colors = ["white","Crimson","Khaki","CornflowerBlue","LightGreen"] 

function* init() {
    document.title = "Blackboard Application"

    window.message = document.createElement("p") 
    document.body.appendChild(window.message)

    window.message.innerText = "Connecting..."

    ///////////////////////////////////////////////// Data initialization
    
    // Data for drawing
    window.pos = [0, 0]       // camera position
    window.summonpos = [0, 0]

    window.img_data = {}
 
    // personal data
    window.mode = "point" 
    window.color = "white"
    window.zoom = 0
    window.selection = [] // [[x,y,w,h]]

    window.pointcolor = "hsl("+Math.floor(Math.random()*256)+", 100%, 52%)"
    window.point_actions = []
    
    window.save_data = []
    window.save_highlights = []
    
    window.load_data = []
    window.load_highlights = {}

    ////////////////////////////////////////////////// Make Connection

    var urlParams = new URLSearchParams(window.location.search);
    window.hostId = undefined
    for (var key of urlParams.keys()) {
        window.hostId = key
        break
    }

    
    if (!window.hostId) {
        window.hostId = window.words[Math.floor(Math.random()*window.words.length)]
        window.history.pushState(null, "Blackboard Application", "?"+window.hostId)
        yield* init_host(window.hostId,[])
    } else {
        yield* init_client(window.hostId,[])
    }

    ///////////////////////////////////////////////// Drawing init


    document.body.removeChild(window.message)

    window.canvas = document.createElement("canvas")
    document.body.appendChild(window.canvas)
 

    



    ////////////////////// Events

    window.canvas.width = window.innerWidth
    window.canvas.height = window.innerHeight
    window.addEventListener("resize", function() {
        window.canvas.width = window.innerWidth
        window.canvas.height = window.innerHeight
        draw()
    })
    mode_switch_events() 
    key_mode_events()
    mode_buttons()
    point_events()
    pan_events()
    draw_erase_events() 
    move_events()
    text_events()
    save_events()
    load_events()

    draw()
}


function* init_host(key, init_friends) {

    window.friendsConns = {}
    console.log("Attempting to become host '"+key+"'...")

    window.peer = new Peer(key,{"debug":2})



    var es = yield* any({
        "open": on_event(window.peer,"open"),
        "error": on_event(window.peer,"error"),
    })

    if (es.error) {
        console.log("Got error: "+es.error)
        window.peer.destroy()
        yield* init_client(key,init_friends)
    } else {
        var [e, id] = es.open
        window.peer.on('connection', connection);
        window.id = id
        console.log("My id:", window.id)

        window.peer.on('error', function(e) {
            console.log("Error:",e.message)
        })

        for (var friend of init_friends) {
            console.log("reconnecting to "+friend)
            var c = window.peer.connect(friend,{reliable:true})
            connection(c)
        }

        set_message()
    }
}

function* init_client(key, init_friends) {

    window.friendsConns = {}
    window.peer = new Peer(null,{"debug":2})

    var es = yield* any({
        "open": on_event(window.peer,"open"),
        "error": on_event(window.peer,"error"),
    })
    if (es.error) {
        window.message.innerText = "Failed to connect to PeerJS server.\nError: "+es.error[1].message
        return
    }
    var [e,id] = es.open



    window.peer.on('connection', connection);

    window.id = id
    console.log("My id:", window.id)

    console.log("Attempting to become client to host '"+key+"'...")

    var c = peer.connect(key, {reliable: true})
    connection(c)

    var es = yield* any({
        "open": on_event(c,"open"),
        "error": on_event(window.peer,"error"),
        "timeout": wait(window.host_timeout)
    })

    if (es.error || es.timeout) {
        if (es.error) console.log("Got error: "+es.error)
        if (es.timeout) console.log("Timed out.")
        window.peer.destroy()
        yield* init_host(key,init_friends)
    } else {
        window.peer.on('error', function(e) {
            console.log("Error:",e.message)
        })

        window.hostId = key

        for (var friend of init_friends) {
            console.log("reconnecting to "+friend)
            var c = window.peer.connect(friend,{reliable:true})
            connection(c)
        }

        set_message()


    }
}




function connection(c) {
    c.on("open", function() {
        window.friendsConns[c.peer] = c
        c.send({"kind":"friends", "friends":window.Object.keys(friendsConns)})
        console.log("Friends list:", Object.keys(window.friendsConns))
       
        if (c.peer == window.hostId &&  Object.keys(window.img_data).length == 0) {
            c.send({"kind":"request_img_data", "id":window.id})
        }

        set_message()
    })
    c.on("data", function(data) {

        if (data.kind == "friends") {
            for (var id of data.friends) {
                if (id == window.id) continue
                if (!(id in window.friendsConns)) {
                    var c = peer.connect(id, {reliable: true})
                    connection(c)
                }
            }
        } else if (data.kind == "request_img_data") {
            for (var ch in window.img_data) { 
                window.friendsConns[data.id].send({
                    "kind": "chunk_update",
                    "chunk": ch,
                    "data": window.img_data[ch].data
                })
            }
        } else {
            receive_message(data) 
        }
    })
    
    c.on("error", function(e) {
        console.log("Error:", e.message)
    })

    c.on("close", function() {
        console.log("got close from "+ c.peer)
        delete window.friendsConns[c.peer]
        console.log("Friends list:", Object.keys(window.friendsConns))
       
        if (c.peer == window.hostId) {
            launch(ensure_have_host())
        }

        set_message()
    })
}

function* ensure_have_host() {
    var good = true
    for (var key in window.friendsConns) {
        if (key.localeCompare(self.id,"en-US") > 0) {
            good = false
            break
        }
    }
    if (good) {
        console.log("I'll try to become '"+window.hostId+"' now.")
        var init_friends = Object.keys(window.friendsConns)
        for (var key in window.friendsConns) {
            window.friendsConns[key].close() 
        }
        yield* wait(500)
        yield* init_host(window.hostId, init_friends)
    }
}


function set_message() {
    if (Object.keys(window.friendsConns).indexOf(window.hostId) == -1) {
        if (window.id == window.hostId) {
            window.message.innerText = "I am host '"+window.hostId+"'."
        } else {
            window.message.innerText = "I am a client with id '"+window.id+"', but I lost my connection to host '"+window.hostId+"'."
        }
    } else {
        window.message.innerText = "I am a client connected to host '"+window.hostId+"' with id '"+window.id+"'"
    }
}


///////////////////////////////////////////////////////


function draw() {
    var ctx = window.canvas.getContext("2d")

    ctx.fillStyle = "black"
    ctx.setTransform(1,0,0,1,0,0)
    ctx.fillRect(0,0,window.canvas.width, window.canvas.height)

    var zoomfactor = Math.pow(window.zoom_base, window.zoom)

    var [px,py] = window.pos
    var [w,h] = [window.canvas.width,window.canvas.height]
    ctx.scale(zoomfactor,zoomfactor)
    ctx.translate(-px, -py)


    
    var c = window.chunk_size
    var tl = chunk_for_point([px-c/zoomfactor,py-c/zoomfactor])
    var br = chunk_for_point([px+(w+c)/zoomfactor,py+(h+c)/zoomfactor])
    
   
    if (window.tmpctx == undefined) {
        window.tmpcanvas = document.createElement("canvas")
        window.tmpcanvas.width = window.chunk_size
        window.tmpcanvas.height = window.chunk_size
        window.tmpctx = window.tmpcanvas.getContext("2d")
    }


    for (var cx = tl[0]; cx <= br[0]; cx += window.chunk_size) {
        for (var cy = tl[1]; cy <= br[1]; cy += window.chunk_size) {
            var c = [cx,cy]
            if (window.img_data[c] != undefined) {
                window.tmpctx.putImageData(window.img_data[c],0,0)
                ctx.drawImage(window.tmpcanvas,cx,cy)
            }
        }
    }

    ///////////////////////////////////////////////////////

    /// draw chunks to save
   
    if (window.mode == "save") {
        for (var cx = tl[0]; cx <= br[0]; cx += window.chunk_size) {
            for (var cy = tl[1]; cy <= br[1]; cy += window.chunk_size) {
                var c = [cx,cy]
                var found = false
                for (var dat of window.save_data) {
                    if (c in dat) {
                        found = true
                        break;
                    }
                }
                if (window.save_highlights.indexOf(c+"") > -1) {
                    ctx.fillStyle = "rgba(0,255,0,0.3)"
                    ctx.fillRect(cx,cy,window.chunk_size, window.chunk_size)
                } else if (found) {
                    ctx.fillStyle = "rgba(0,0,255,0.3)"
                    ctx.fillRect(cx,cy,window.chunk_size, window.chunk_size)
                }
            }
        }
    }


  
    if (window.mode == "load") {
        for (var cx = tl[0]; cx <= br[0]; cx += window.chunk_size) {
            for (var cy = tl[1]; cy <= br[1]; cy += window.chunk_size) {
                var c = [cx,cy]
                if (window.load_highlights[c] != undefined) {
                    window.tmpctx.putImageData(window.load_highlights[c],0,0)
                    ctx.drawImage(window.tmpcanvas,cx,cy)
                    ctx.fillStyle = "rgba(0,0,255,0.3)"
                    ctx.fillRect(cx,cy,window.chunk_size, window.chunk_size)
                }
            }
        }
    }




    //// draw selection

    ctx.fillStyle = "rgba(255,255,255,0.3)"

    for (var rect of window.selection) {
        ctx.fillRect(rect[0],rect[1],rect[2],rect[3])
    }

    /// draw pointer
    
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    var t0 = Date.now()
    var new_actions = []
    for (var action of window.point_actions) {

        var new_action = {
            "t": action.t,
            "pts": [],
            "color":action.color
        }

        ctx.strokeStyle = action.color

        for (var i = 0; i < action.pts.length-1; i++) {
            var dt = t0 - action.pts[i][2]
            if (dt < 0) dt = 0
            if (dt > 900) continue
            new_action.pts.push(action.pts[i])

            ctx.lineWidth = 5*(1000 - dt)/1000
            ctx.beginPath()
            ctx.moveTo(action.pts[i][0],action.pts[i][1])
            ctx.lineTo(action.pts[i+1][0],action.pts[i+1][1])
            ctx.stroke()
        }
        var last_pt = action.pts[action.pts.length-1]
        if (t0 - last_pt[2] <= 900) new_action.pts.push(last_pt)

        if (new_action.pts.length > 0) {
            new_actions.push(new_action)
        }
    }
    window.point_actions = new_actions

    var redraw_soon = window.point_actions.length > 0
    redraw_soon ||= window.summonpos[0] != window.pos[0]
    redraw_soon ||= window.summonpos[1] != window.pos[1]
    if (redraw_soon) {
        window.requestAnimationFrame(function(dt) {
            var dx = (window.summonpos[0] - window.pos[0])
            var dy = (window.summonpos[1] - window.pos[1])

            if (dx != 0 || dy != 0) {
                var l = Math.sqrt(dx*dx + dy*dy)
                var d = 0.001*dt
                if (l < d) {
                    window.pos[0] = window.summonpos[0]
                    window.pos[1] = window.summonpos[1]
                } else {
                    window.pos[0] += d*dx/l
                    window.pos[1] += d*dy/l
                }
            }
            draw()
        })
    }


    //////////////////////////////////////////////////////

    draw_menu()
    
}


