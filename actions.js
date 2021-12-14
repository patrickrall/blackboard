
function send_message(msg) {
    for (var id in window.friendsConns) {
        window.friendsConns[id].send(msg)
    }
}

function send_receive_message(msg) {
    receive_message(msg)
    send_message(msg)
}

function receive_message(msg) {

    if (msg.kind == "point_begin") {
        window.point_actions.push({
            "t": msg.t,
            "pts": [[msg.x,msg.y,Date.now()]],
            "color": msg.color
        })
        draw()
    }

    if (msg.kind == "point_move") {
        var found = false
        var t = msg.t
        t = Date.now() // an attempt to hack the issue where long lines dissappear
        for (var action of window.point_actions) {
            if (action.t == msg.target) {
                action.pts.push([msg.x,msg.y,t])
                found = true
                break
            }
        }
        if (!found) window.point_actions.push({
            "t": msg.target,
            "pts": [[msg.x,msg.y,t]],
            "color": msg.color
        })
        draw()
    }

    if (msg.kind == "summon") {
        var [cx,cy] = msg.pos
        var [w,h] = [window.canvas.width,window.canvas.height]
        var zoomfactor = Math.pow(window.zoom_base, window.zoom)
        window.summonpos = [cx - (w/2)/zoomfactor , cy - (h/2)/zoomfactor]
        draw()
    }



    if (msg.kind == "chunk_update") {
        var c = msg.chunk
        window.img_data[c] = new ImageData(new Uint8ClampedArray(msg.data), window.chunk_size)
        delete window.ctx_cache[c]
        draw()
    }
}



//////////////////////////////////////


function chunk_for_point(p) {
    var [x,y] = p

    var cx = x - x % window.chunk_size
    if (x < 0) cx -= window.chunk_size

    var cy = y - y % window.chunk_size
    if (y < 0) cy -= window.chunk_size

    return [cx, cy]
}

function nearby_chunks(ps,r) {
    var out = []

    var insert_if_not_present = function(l,e) {
        for (var el of l) {
            if (el[0] == e[0] && el[1] == e[1]) return
        }
        l.push(e)
    }

    for (var p of ps) {
        var [x,y] = p
        insert_if_not_present(out,chunk_for_point([x+r,y+r]))
        insert_if_not_present(out,chunk_for_point([x+r,y-r]))
        insert_if_not_present(out,chunk_for_point([x-r,y+r]))
        insert_if_not_present(out,chunk_for_point([x-r,y-r]))
    }

    return out
}


window.ctx_cache = {}
function get_ctx(c) {
    if (window.ctx_cache[c] != undefined) return window.ctx_cache[c]
    
    var canvas = document.createElement("canvas")
    canvas.width = window.chunk_size
    canvas.height = window.chunk_size

    var ctx = canvas.getContext("2d")
    if (window.img_data[c] != undefined) {
        ctx.putImageData(window.img_data[c],0,0)
    }
    var [cx,cy] = c
    ctx.setTransform(1,0,0,1,-cx,-cy)
    window.ctx_cache[c] = ctx
    return ctx
}

function save_ctx(c) {
    if (window.ctx_cache[c] == undefined) return
    var ctx = window.ctx_cache[c]
    
    window.img_data[c] = ctx.getImageData(0,0,window.chunk_size,window.chunk_size)

    send_message({
        "kind": "chunk_update",
        "chunk": c,
        "data": window.img_data[c].data
    })

}
// manually clear cache via
// delete window.ctx_cache[c]
// window.ctx_cache = {}

// remember to clear the ctx cache for any chunks updated by a message

////////////////////////////////////////

// from screen [e.offsetX, e.offsetY] to 
function convert_point(p) {
    var [x,y] = p
    var [px,py] = window.pos
    var zoomfactor = Math.pow(window.zoom_base, window.zoom)
    return [(x)/zoomfactor  + px, (y)/zoomfactor+ py] 
}

window.active_touch = null
function add_mouse_event(event_name, convert, func) {

    function pad_shift(p,sh) {
        var [x,y] = p
        return [x,y,sh]
    }

    var mouse_handler = function(e) {
        e.preventDefault()
        if (event_name != "mousemove" && e.which != 1) return
        var p = [e.offsetX, e.offsetY]
        if (convert) func(pad_shift(convert_point(p),e.shiftKey))
        else func(pad_shift(p,e.shiftKey))
    }
    var touch_handler = function(e) {

        if (event_name != "mouseup") {
            if (e.touches.length == 0) return
            if (window.active_touch == null) {
                window.active_touch = e.touches[0]
            } else {
                for (var t of e.touches) {
                    if (t.identifier == window.active_touch.identifier) {
                        window.active_touch = t
                        break
                    }
                }
            }
        } else {
            for (var t of e.touches) {
                if (t.identifier == window.active_touch.identifier) return
            }
            window.active_touch = null
        }
        e.preventDefault()
        if (window.active_touch == null) var p = [0,0]
        else var p = [window.active_touch.clientX, window.active_touch.clientY]
        if (convert) func(pad_shift(convert_point(p),e.shiftKey))
        else func(pad_shift(p,e.shiftKey))
        if (event_name == "mouseup") window.active_touch = null
    }

    if (event_name == "click") {
        window.canvas.addEventListener("click", mouse_handler)
        return
    }
    
    if (event_name == "mousedown") {
        window.canvas.addEventListener("mousedown", mouse_handler)
        window.canvas.addEventListener("touchstart", touch_handler)
        return
    }

    if (event_name == "mousemove") {
        window.canvas.addEventListener("mousemove", mouse_handler)
        window.canvas.addEventListener("touchmove", touch_handler)
        return
    }

    if (event_name == "mouseup") {
        window.canvas.addEventListener("mouseup", mouse_handler)
        window.canvas.addEventListener("touchend", touch_handler)
        window.canvas.addEventListener("mouseoff", mouse_handler)
        window.canvas.addEventListener("touchcancel", touch_handler)
        return
    }

    throw "Invalid event "+event_name
}



/////////////////////////////////////////////////////////////////////

function point_events() {

    window.point_time = Date.now()
    window.point_down = false

    add_mouse_event("mousedown",true, function(p) {
        var [x,y] = p
        if (window.mode != "point") return
        if (in_menu_region(p,true)) return
    
        window.point_down = true
        window.point_time = Date.now()

        send_receive_message({"kind": "point_begin",
                      "t":window.point_time, 
                      "x":x, "y":y,
                      "color":window.pointcolor
                     })
    })

    add_mouse_event("mousemove",true, function(p) {
        var [x,y] = p
        if (window.mode != "point") return
        if (!window.point_down) return

        if (Date.now() - window.point_time > 2000) return // cant cursor for too long

        send_receive_message({"kind": "point_move",
                              "t":Date.now(), "target":window.point_time,
                              "x":x, "y":y, 
                              "color":window.pointcolor
                             })
    })
    add_mouse_event("mouseup",true, function(p) {
        window.point_down = false
    })
}


/////////////////////////////////////////////////////////////////////

function pan_events() {
    window.pan_mouse_start = null
    window.pan_pos_start = null

    add_mouse_event("mousedown",false, function(p) {
        var [x,y] = p
        if (window.mode != "pan") return
        if (in_menu_region(p,false)) return
        window.pan_mouse_start = p
        window.pan_pos_start = [window.pos[0],window.pos[1]]
    })

    add_mouse_event("mousemove",false, function(p) {
        var [x,y] = p
        if (window.mode != "pan") return
        if (window.pan_mouse_start == null) return
        var [px,py] = window.pan_pos_start
        var [mx,my] = window.pan_mouse_start
        window.pos = [px - (x-mx), py - (y-my)]
        window.summonpos = [window.pos[0],window.pos[1]]
        draw()
    })
    add_mouse_event("mouseup",false, function(p) {
        if (window.mode != "pan") return
        window.pan_mouse_start = null
        window.pan_pos_start = null
    })

}


/////////////////////////////////////////////////////////////////////

function draw_erase_events() {

    window.previous_point = null

    add_mouse_event("mousedown",true, function(p) {
        var [x,y] = p
        if (window.mode != "draw" && window.mode != "erase") return
        if (in_menu_region(p,true)) return
        window.previous_point = [x,y]
    })

    var continue_stroke = function(px,py,x,y) {

        var zoomfactor = Math.pow(window.zoom_base, window.zoom)
        if (window.mode == "erase") var r = 20/zoomfactor
        else var r = 2

        for (var c of nearby_chunks([[px,py],[x,y]],r)) {
            if (window.mode == "draw") {
                var ctx = get_ctx(c) 
                ctx.lineCap = "round"
                ctx.lineWidth = r
                ctx.strokeStyle = window.color
                ctx.beginPath()
                ctx.moveTo(px,py)
                ctx.lineTo(x,y)
                ctx.stroke()
            } else {
                var ctx = get_ctx(c) 
                ctx.save()
                ctx.beginPath()
                ctx.strokeStyle = "rgba(0,0,0,0)"
                ctx.arc(x, y, r, 0, 2 * Math.PI)
                ctx.stroke()
                ctx.clip()
                ctx.clearRect(x-2*r,y-2*r,4*r,4*r)
                ctx.restore()
            }
            save_ctx(c)
        }
        draw()
    }


    add_mouse_event("mousemove",true, function(p) {
        var [x,y] = p
        if (window.mode != "draw" && window.mode != "erase") return
        if (window.previous_point == null) return
        var [px,py] = window.previous_point
        continue_stroke(px,py,x,y)
        window.previous_point = [x,y]
        

    })
    add_mouse_event("mouseup",true, function(p) {
        var [x,y] = p
        if (window.mode != "draw" && window.mode != "erase") return
        if (window.previous_point == null) return
        var [px,py] = window.previous_point
        continue_stroke(px,py,x,y)
        window.previous_point = null
        window.ctx_cache = {}
    })
}

/////////////////////////////////////////////////////////////////////

function move_events() {
    window.move_mouse_pos = null
    window.move_create_selection = -1
    window.move_data = []
    window.move_prv_data = []

    add_mouse_event("mousedown",true, function(p) {
        var [x,y,sh] = p
        if (window.mode != "move") return
        if (in_menu_region(p,true)) return
        window.move_mouse_pos = p
        
        var in_selection = false
        for (var i in window.selection) {
            var r = window.selection[i]
            if (x < r[0]) continue
            if (r[0] + r[2] < x) continue
            if (y < r[1]) continue
            if (r[1] + r[3] < y) continue
            in_selection = true
            break
        }
       

        // make a temporary canvas
        if (window.move_tmp_canvas_1 === undefined) window.move_tmp_canvas_1 = document.createElement("canvas")

        window.move_create_selection = -1
        if (!in_selection)  {
            if (!sh) {
                window.selection = []
                window.move_data = []
                window.move_prv_data = []
            }
            window.move_create_selection = window.selection.length

            window.selection.push([x,y,0,0])
            var ctx1 = window.move_tmp_canvas_1.getContext('2d')
            window.move_data.push(null)
            window.move_prv_data.push(null)

            draw()
        }

        })

    add_mouse_event("mousemove",true, function(p) {
        var [x,y] = p
        if (window.mode != "move") return
        if (window.move_mouse_pos == null) return
        var [px,py] = window.move_mouse_pos

        if (window.selection.length == 0) return
        if (window.move_create_selection != -1) {
            var r = window.selection[window.move_create_selection]
            if (px < x) { r[0] = px; r[2] = x - px }
            else { r[0] = x; r[2] = px - x }
            if (py < y) { r[1] = py; r[3] = y - py }
            else { r[1] = y; r[3] = py - y }
        } else {
            var [dx, dy] = [x - px, y - py]
            window.move_mouse_pos = [x,y]
           
            
            // compute the bounds of all selected rectangles
            var r0 = window.selection[0]
            var bounds = [r0[0],r0[1],r0[2],r0[3]]
            for (var i in window.selection) {
                var r = window.selection[i]
                if (r[0] < bounds[0]) {bounds[2] += bounds[0]-r[0]; bounds[0] = r[0]}
                if (bounds[0] + bounds[2] < r[0] + r[2]) bounds[2] = r[0] + r[2] - bounds[0]
                if (r[1] < bounds[1]) {bounds[3] += bounds[1]-r[1]; bounds[1] = r[1]}
                if (bounds[1] + bounds[3] < r[1] + r[3]) bounds[3] = r[1] + r[3] - bounds[1]
            }
           
            // extend bounds to include the shift as well
            bounds[2] += Math.abs(dx)
            bounds[3] += Math.abs(dy)
            if (dx < 0) bounds[0] += dx
            if (dy < 0) bounds[1] += dy

            // extend bounds to line up with chunks
            var tl = chunk_for_point([bounds[0],bounds[1]])
            var br = chunk_for_point([bounds[0]+bounds[2]+window.chunk_size,
                                      bounds[1]+bounds[3]+window.chunk_size])
            bounds[0] = tl[0]
            bounds[1] = tl[1]
            bounds[2] = br[0] - bounds[0]
            bounds[3] = br[1] - bounds[1]

            // make some temporary canvases
            if (window.move_tmp_canvas_1 === undefined) window.move_tmp_canvas_1 = document.createElement("canvas")
            if (window.move_tmp_canvas_2 === undefined) window.move_tmp_canvas_2 = document.createElement("canvas")
            window.move_tmp_canvas_1.width = bounds[2]
            window.move_tmp_canvas_1.height = bounds[3]
            var ctx1 = window.move_tmp_canvas_1.getContext('2d')
            ctx1.setTransform(1,0,0,1,-bounds[0],-bounds[1])
            var ctx2 = window.move_tmp_canvas_2.getContext('2d')
           
            // copy the existing image data
            var any_data = false
            for (var cx = tl[0]; cx < br[0]; cx += window.chunk_size) {
                for (var cy = tl[1]; cy < br[1]; cy += window.chunk_size) {
                    var c = [cx,cy]
                    if (window.img_data[c] != undefined) {
                        any_data = true
                        window.tmpctx.putImageData(window.img_data[c],0,0)
                        ctx1.drawImage(window.tmpcanvas,cx,cy)
                    }
                }
            }
            
            // replace source rectangles with what they were before
            for (var i in window.selection) {
                var r = window.selection[i]

                window.move_tmp_canvas_2.width = r[2]
                window.move_tmp_canvas_2.height = r[3]
                ctx2.putImageData(window.move_prv_data[i],0,0)
                ctx1.clearRect(r[0],r[1],r[2],r[3])
                ctx1.drawImage(window.move_tmp_canvas_2, r[0], r[1])
            }
            
            // shift the rectangles
            for (var i in window.selection) {
                var r = window.selection[i]
                r[0] += dx
                r[1] += dy
            }
           
            // place target rects, but save previous data first
            for (var i in window.selection) {
                var r = window.selection[i]

                window.move_tmp_canvas_2.width = r[2]
                window.move_tmp_canvas_2.height = r[3]

                window.move_prv_data[i] = ctx1.getImageData(r[0]-bounds[0],r[1]-bounds[1],r[2],r[3])

                ctx2.putImageData(window.move_data[i],0,0)
                ctx1.drawImage(window.move_tmp_canvas_2, r[0], r[1])
            }

            // update chunks from ctx1
            for (var cx = tl[0]; cx < br[0]; cx += window.chunk_size) {
                for (var cy = tl[1]; cy < br[1]; cy += window.chunk_size) {
                    var c = [cx,cy]
                    window.img_data[c] = ctx1.getImageData(cx-bounds[0],cy-bounds[1],window.chunk_size,window.chunk_size)

                    send_message({
                        "kind": "chunk_update",
                        "chunk": c,
                        "data": window.img_data[c].data
                    })
                }
            }

        } 

        draw()
    })
    add_mouse_event("mouseup",true, function(p) {
        if (window.mode != "move") return
        window.move_mouse_pos = null

        if (window.selection.length == 0) return
        if (window.move_create_selection == -1) return

        var r = window.selection[window.move_create_selection]

        if (r[2] == 0 || r[3] == 0) {
            window.selection.splice(window.move_create_selection,1)
            window.move_data.splice(window.move_create_selection,1)
            window.move_prv_data.splice(window.move_create_selection,1)
            return
        }

        var tl = chunk_for_point([r[0],r[1]])
        var br = chunk_for_point([r[0]+r[2]+window.chunk_size,
                                  r[1]+r[3]+window.chunk_size])

        window.move_tmp_canvas_1.width = br[0]-tl[0]
        window.move_tmp_canvas_1.height = br[1]-tl[1]
        var ctx1 = window.move_tmp_canvas_1.getContext('2d')
        ctx1.setTransform(1,0,0,1,-tl[0],-tl[1])

        // copy existing data
        for (var cx = tl[0]; cx < br[0]; cx += window.chunk_size) {
            for (var cy = tl[1]; cy < br[1]; cy += window.chunk_size) {
                var c = [cx,cy]
                if (window.img_data[c] != undefined) {
                    any_data = true
                    window.tmpctx.putImageData(window.img_data[c],0,0)
                    ctx1.drawImage(window.tmpcanvas,cx,cy)
                }
            }
        }
        window.move_data[window.move_create_selection] = ctx1.getImageData(r[0]-tl[0],r[1]-tl[1],r[2],r[3])
        ctx1.clearRect(r[0],r[1],r[2],r[3])
        window.move_prv_data[window.move_create_selection] = ctx1.getImageData(r[0]-tl[0],r[1]-tl[1],r[2],r[3])

    })

    window.addEventListener("keydown", function(e) {
        if (window.mode != "move") return
        if (e.code != "Delete") return

        if (window.selection.length == 0) return

        // compute the bounds of all selected rectangles
        var r0 = window.selection[0]
        var bounds = [r0[0],r0[1],r0[2],r0[3]]
        for (var i in window.selection) {
            var r = window.selection[i]
            if (r[0] < bounds[0]) {bounds[2] += bounds[0]-r[0]; bounds[0] = r[0]}
            if (bounds[0] + bounds[2] < r[0] + r[2]) bounds[2] = r[0] + r[2] - bounds[0]
            if (r[1] < bounds[1]) {bounds[3] += bounds[1]-r[1]; bounds[1] = r[1]}
            if (bounds[1] + bounds[3] < r[1] + r[3]) bounds[3] = r[1] + r[3] - bounds[1]
        }
       
        // extend bounds to line up with chunks
        var tl = chunk_for_point([bounds[0],bounds[1]])
        var br = chunk_for_point([bounds[0]+bounds[2]+window.chunk_size,
                                  bounds[1]+bounds[3]+window.chunk_size])
        bounds[0] = tl[0]
        bounds[1] = tl[1]
        bounds[2] = br[0] - bounds[0]
        bounds[3] = br[1] - bounds[1]


        // make some temporary canvases
        if (window.move_tmp_canvas_1 === undefined) window.move_tmp_canvas_1 = document.createElement("canvas")
        if (window.move_tmp_canvas_2 === undefined) window.move_tmp_canvas_2 = document.createElement("canvas")
        window.move_tmp_canvas_1.width = bounds[2]
        window.move_tmp_canvas_1.height = bounds[3]
        var ctx1 = window.move_tmp_canvas_1.getContext('2d')
        ctx1.setTransform(1,0,0,1,-bounds[0],-bounds[1])
        var ctx2 = window.move_tmp_canvas_2.getContext('2d')

        // copy the existing image data
        var any_data = false
        for (var cx = tl[0]; cx < br[0]; cx += window.chunk_size) {
            for (var cy = tl[1]; cy < br[1]; cy += window.chunk_size) {
                var c = [cx,cy]
                if (window.img_data[c] != undefined) {
                    any_data = true
                    window.tmpctx.putImageData(window.img_data[c],0,0)
                    ctx1.drawImage(window.tmpcanvas,cx,cy)
                }
            }
        }
        
        // replace source rectangles with what they were before
        for (var i in window.selection) {
            var r = window.selection[i]

            window.move_tmp_canvas_2.width = r[2]
            window.move_tmp_canvas_2.height = r[3]
            ctx2.putImageData(window.move_prv_data[i],0,0)
            ctx1.clearRect(r[0],r[1],r[2],r[3])
            ctx1.drawImage(window.move_tmp_canvas_2, r[0], r[1])
        }

        // update chunks from ctx1
        for (var cx = tl[0]; cx < br[0]; cx += window.chunk_size) {
            for (var cy = tl[1]; cy < br[1]; cy += window.chunk_size) {
                var c = [cx,cy]
                window.img_data[c] = ctx1.getImageData(cx-bounds[0],cy-bounds[1],window.chunk_size,window.chunk_size)

                send_message({
                    "kind": "chunk_update",
                    "chunk": c,
                    "data": window.img_data[c].data
                })
            }
        }

        window.selection = []
        window.move_data = []
        window.move_prv_data = []

        draw()
    })
}

/////////////////////////////////////////////////////////////////////

window.latexTmp = document.createElement("div")
window.latexTmp.style.display = "none"

document.body.appendChild(window.latexTmp)

function text_events() {
    add_mouse_event("mousedown",true, function(p) {
        if (window.mode != "text") return
        if (in_menu_region(p,true)) return
        
        var target_text = prompt("Enter text (use $ for LaTeX):")

        if (target_text == null) return
        
        launch((function*() {

            if (window.text_tmp_canvas === undefined) {
                window.text_tmp_canvas = document.createElement("canvas")
            }
            var ctx = window.text_tmp_canvas.getContext('2d')
            ctx.setTransform(1,0,0,1,0,0)
            ctx.font = "20px sans"

            var data = []
            var w = 0
            var h = 25

            var s = 1.5
            
            var latex = false
            for (var text of target_text.split("$")) {
                if (latex) {
                    var options = MathJax.getMetricsFor(window.latexTmp)
                    var latex_output = {}
                    MathJax.tex2svgPromise(text, options).then(function (node) {
                        var svg = node.getElementsByTagName("svg")[0]
                        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
                        svg.setAttribute("color", "white")
                        var image = new Image()
                        image.src = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(svg.outerHTML)))
                        image.onload = function () {
                            latex_output["out"] = image
                            dispatch_event("latex_render_complete")
                        }
                        MathJax.startup.document.clear()
                        MathJax.startup.document.updateDocument()
                    })

                    yield* named_event("latex_render_complete") 
                    var img = latex_output["out"]
                    data.push(img)
                    w += img.width*s
                    if (h < img.height*s) h = img.height*s
                } else {
                    data.push(text)
                    w += ctx.measureText(text).width
                    w += 10
                }
                latex = !latex
            }


            var tl = chunk_for_point(p)
            var br = chunk_for_point([p[0]+w+window.chunk_size,
                                      p[1]+h+window.chunk_size])

            window.text_tmp_canvas.width = br[0] - tl[0]
            window.text_tmp_canvas.height = br[1] - tl[1]
            ctx.setTransform(1,0,0,1,-tl[0],-tl[1])
            
            for (var cx = tl[0]; cx < br[0]; cx += window.chunk_size) {
                for (var cy = tl[1]; cy < br[1]; cy += window.chunk_size) {
                    var c = [cx,cy]
                    if (c in window.img_data) {
                        window.tmpctx.putImageData(window.img_data[c],0,0)
                        ctx.drawImage(window.tmpcanvas, cx, cy)
                    }
                }
            }

            ctx.fillStyle = "white"
            ctx.font = "20px sans"
            var x = 0
            for (var i in data) {
                if (i % 2 == 0) {
                    x += 5
                    ctx.fillText(data[i],p[0]+x, h/2+p[1]+6)
                    x += ctx.measureText(data[i]).width
                    x += 5
                } else {
                    ctx.setTransform(1,0,0,1,x+p[0]-tl[0],(h/2 - s*data[i].height/2)+p[1]-tl[1])
                    ctx.scale(s,s)
                    ctx.drawImage(data[i],0,0)
                    x += data[i].width*s
                    ctx.setTransform(1,0,0,1,-tl[0],-tl[1])
                }
            }


            for (var cx = tl[0]; cx < br[0]; cx += window.chunk_size) {
                for (var cy = tl[1]; cy < br[1]; cy += window.chunk_size) {
                    var c = [cx,cy]
                    window.img_data[c] = ctx.getImageData(cx-tl[0],cy-tl[1],window.chunk_size,window.chunk_size)

                    send_message({
                        "kind": "chunk_update",
                        "chunk": c,
                        "data": window.img_data[c].data
                    })
                }
            }

            draw()

        
        })())

                

    })
}

/////////////////////////////////////////////////////////////////////

function clear_chunk_if_empty(c) {
    if (!(c in window.img_data)) return

    var dat = window.img_data[c].data
    
    var tot_alpha = 0
    for (var i = 0; i < window.chunk_size*window.chunk_size; i++) {
        tot_alpha += dat[4*i+3]
        if (tot_alpha > 255*10) {
            return
        }
    }

    delete window.img_data[c]
}


function collect_chunks(c, seen, clear) {
    var [cx,cy] = c
    if (seen.indexOf(c+"") != -1) return
    if (clear) clear_chunk_if_empty(c)
    if (!(c in window.img_data)) return

    for (var dat of window.save_data) {
        if (c in dat) return
    }
    seen.push(c+"")

    collect_chunks([cx+window.chunk_size, cy],seen,clear)
    collect_chunks([cx-window.chunk_size, cy],seen,clear)
    collect_chunks([cx, cy+window.chunk_size],seen,clear)
    collect_chunks([cx, cy-window.chunk_size],seen,clear)
}

function save_events() {
    add_mouse_event("mousedown",true, function(p) {
        if (window.mode != "save") return
        if (in_menu_region(p,true)) return
        var c = chunk_for_point(p)
        var new_region = []
        collect_chunks(c, new_region,true)

        if (new_region.length != 0) {
            var region_data = {}
            for (var c of new_region) {
                region_data[c] = window.img_data[c]
            }
            window.save_data.push(region_data) 
            draw()
        } else {
            var found = -1
            for (var i in window.save_data) {
                if (c in window.save_data[i]) {
                    found = i
                    break
                }
            }
            if (found > -1) {
                window.save_data.splice(found,1)
                draw()
            }
        }

    })

    add_mouse_event("mousemove",true, function(p) {
        if (window.mode != "save") return
        var c = chunk_for_point(p)
        window.save_highlights = []
        collect_chunks(c, window.save_highlights,true)
        draw()
    })



}


/////////////////////////////////////////////////////////////////////

function load_events() {

    add_mouse_event("mousedown",true, function(p) {
        if (window.mode != "load") return
        window.load_highlights = {}
        if (window.load_data.length == 0) { draw(); return }
        if (in_menu_region(p,true)) return
        var [mx,my] = chunk_for_point(p)

        for (var ch in window.load_data[0]) {
            var [cx,cy] = JSON.parse("["+ch+"]")
            var chp = [mx+cx,my+cy]
            if (chp in window.img_data) {
                var ctx = get_ctx(chp)
                window.tmpctx.putImageData(window.load_data[0][ch],0,0)
                ctx.drawImage(window.tmpcanvas,mx+cx,my+cy)
                save_ctx(chp)
            } else {
                window.img_data[chp] = window.load_data[0][ch]
            }

            send_message({
                "kind": "chunk_update",
                "chunk": chp,
                "data": window.img_data[chp].data
            })

        }
        window.load_data.splice(0,1)

        draw()

    })

    add_mouse_event("mousemove",true, function(p) {
        if (window.mode != "load") return
        window.load_highlights = {}
        if (window.load_data.length == 0) { draw(); return }

        var [mx,my] = chunk_for_point(p)

        for (var ch in window.load_data[0]) {
            var [cx,cy] = JSON.parse("["+ch+"]")
            window.load_highlights[[mx+cx,my+cy]] = window.load_data[0][ch]
        }
        draw()

    })

    window.canvas.addEventListener("mouseleave", function(e) {
        if (window.mode != "load") return
        window.load_highlights = {}
        draw()
    }) 

}
