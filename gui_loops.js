


function* viewport_loop() {
    while (true) {
        window.canvas.width = window.innerWidth
        window.canvas.height = window.innerHeight
        draw()
        yield* event_listener(window,"resize")
    }
}

function* mode_loop() {
    while (true) {
        var [_, e] = yield* event_listener(canvas,"mousedown")
        var [x,y] = [e.offsetX, e.offsetY]
        if (e.which != 1) continue

        if (window.mode == "stroke" && x < window.colors.length*30+10 && y > window.canvas.height - 60 && y < window.canvas.height-30) {
            var xp = 0
            for (var c of window.colors) {
                if ( Math.abs(xp+20 - x) < 10 ) window.color = c
                xp += 30
            }
            draw()
        }

        if (x > 200) continue 
        if (y < window.canvas.height - 30) continue
        if (0 < x && x < 53) window.mode = "stroke"
        if (53 < x && x < 104) {
            if (window.mode != "erase_split" && window.mode != "erase_simple") {
                window.mode = "erase_split"
            } else if (window.mode == "erase_split") {
                window.mode = "erase_simple"
            } else if (window.mode == "erase_simple") {
                window.mode = "erase_split"
            }
        }
        if (104 < x && x < 148) window.mode = "text"
        if (148 < x && x < 200) {
            if (window.mode != "move_split" && window.mode != "move_simple") {
                window.mode = "move_split"
            } else if (window.mode == "move_split") {
                window.mode = "move_simple"
            } else if (window.mode == "move_simple") {
                window.mode = "move_split"
            }
        }
        if (window.mode != "move_split" && window.mode != "move_simple") {
            window.selection = []
        }
        if (window.mode != "text") {
            window.selected_text = false 
        }
        draw()
    }
}

function* key_mode_loop() {
    while (true) {
        var [_, e] = yield* event_listener(window,"keydown")
        
        if (e.ctrlKey) continue
        if (window.selected_text != false) continue

        if (e.code == "KeyD" || e.code == "KeyB") {
            window.mode = "stroke"
        }

        if (!e.shiftKey && e.code == "KeyE") {
            window.mode = "erase_split"
        }
        if (e.shiftKey && e.code == "KeyE") {
            window.mode = "erase_simple"
        }

        if (e.code == "KeyT") {
            window.mode = "text"
        }

        if (!e.shiftKey && e.code == "KeyM") {
            window.mode = "move_split"
        }
        if (e.shiftKey && e.code == "KeyM") {
            window.mode = "move_simple"
        }

        if (window.mode != "move_split" && window.mode != "move_simple") {
            window.selection = []
        }
        if (window.mode != "text") {
            window.selected_text = false 
        }
        draw()
    }
}




function* stroke_erase_loop() {
    while (true) {
        var [_, e] = yield* event_listener(canvas,"mousedown")
        
        if (["stroke","erase_split","erase_simple"].indexOf(window.mode) == -1) continue

        var [x,y] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]
        if (e.which != 1) continue
        if (e.offsetX < 200 && e.offsetY > window.canvas.height - 30) continue 
        if (e.offsetX < window.colors.length*30+10 && e.offsetY > window.canvas.height - 60) continue 

        var t = Date.now()
        var l = []

        send_message({"type": window.mode+"_point", "t":t, "p":[x,y], "color":window.color})
        l.push([x,y])
        
        while (true) {
            var es = yield* any({
                "move": event_listener(canvas,"mousemove"),
                "up": event_listener(canvas,"mouseup"),
                "leave": event_listener(canvas,"mouseleave"),
            })

            if (!es.move) break
            var [_,e] = es.move
            if (e.which != 1) break
            
            var [x,y] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]
            send_message({"type": window.mode+"_point", "t":t, "p":[x,y], "color":window.color})
            l.push([x,y])
        }

        send_message({"type": window.mode+"_finish", "t":t, "points":l, "color":window.color})
    }

}

// dragging about with middle click
function* pan_loop() {
    while (true) {
        var [_, e] = yield* event_listener(canvas,"mousedown")

        if (e.which != 2) continue
        var [x0,y0] = [e.offsetX, e.offsetY]

        var [x1,y1] = [x0,y0]
        var [px,py] = [window.pos.x, window.pos.y]
        
        while (true) {
            var es = yield* any({
                "move": event_listener(canvas,"mousemove"),
                "up": event_listener(canvas,"mouseup"),
                "leave": event_listener(canvas,"mouseleave"),
            })

            if (!es.move) break
            var [_,e] = es.move
            if (e.which != 2) break
            
            var [x1,y1] = [e.offsetX, e.offsetY]
            
            window.pos.x = px - x1 + x0
            window.pos.y = py - y1 + y0

            window.summonpos.x = window.pos.x
            window.summonpos.y = window.pos.y
            draw()            
        }
    }
}


function* text_loop() {
    // textbox can either be affiliated with an existing textbox or not
    

    // if the textbox is inactive and the user clicks
    //      if the user clicks on some text, make the textbox active
    //          and affiliate it with what they clicked on
    //      if the user clicks on empty space, make the textbox active
    //          and unaffiliated
    //
    // when the textbox blurs:
    //      if it's affiliated, modify the textbox
    //      if it's unaffiliated, make a new texbox

    window.textbox = document.createElement("div")
    window.textbox.innerText = ""
    window.textbox.contentEditable = true
    window.textbox.style.display = "none"
    document.body.appendChild(textbox)

    // prevent new lines
    window.textbox.addEventListener('keydown', (e) => {
        if (e.keyCode === 13) {
            textbox.blur()
            e.preventDefault()
        }
    })

    while (true) {
        var [_, e] = yield* event_listener(canvas,"mousedown")
        if (window.mode != "text") continue
        if (e.which != 1) continue  
        if (e.offsetX < 200 && e.offsetY > window.canvas.height - 30) continue 

        var [x,y] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]

        // textbox is guaranteed unaffiliated at this point

        var found = false
        for (var text_rect of window.text_rects) {
            if (x <= text_rect["x"]) continue
            if (text_rect["x"] + text_rect["w"] <= x) continue
            if (y <= text_rect["y"]) continue
            if (text_rect["y"] + text_rect["h"] <= y) continue
            
            found = text_rect
            break
        }

        window.textbox.style.display = ""

        if (found) {
            window.textbox.innerText = found["text"]
            window.textbox.style.left = found["x"] - window.pos.x
            window.textbox.style.top = found["y"] - window.pos.y
            window.selected_text = text_rect["t"]
        } else {
            window.textbox.innerText = ""
            window.textbox.style.left = x - window.pos.x
            y -= 40 // above the cursor
            window.textbox.style.top = y - window.pos.y 
        }
        setTimeout(function() {textbox.focus()})
        
        compute_state()
        draw()

        yield* event_listener(textbox, "blur")
        
        textbox.style.display = "none"
        window.selected_text = false

        var t = Date.now()

        if (found) {
            send_message({"type": "modify_text", "t":t, "text":window.textbox.innerText, "target":found["t"]})
        } else {
            if (window.textbox.innerText.trim() != "") {
                send_message({"type": "insert_text", "t":t, "text":window.textbox.innerText, "p":[x,y]})
            }
        }

        window.selected_text = false
    }
}

// moving 
function* move_loop() {
    while (true) {
        var [_, e] = yield* event_listener(canvas,"mousedown")
        if (["move_split","move_simple"].indexOf(window.mode) == -1) continue

        var [x,y] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]
        if (e.which != 1) continue
        if (e.offsetX < 200 && e.offsetY > window.canvas.height - 30) continue 

        var dragging = false
        for (var rect of window.selection) {
            if (rect[0] <= x && x <= rect[0] + rect[2] &&
                rect[1] <= y && y <= rect[1] + rect[3]) {
                dragging = true
                break
            }
        }

        if (dragging) {
            // move the selection

            var t = Date.now()

            var rects = JSON.parse(JSON.stringify(window.selection)) // deep copy
            
            while (true) {
                var es = yield* any({
                    "move": event_listener(canvas,"mousemove"),
                    "up": event_listener(canvas,"mouseup"),
                    "leave": event_listener(canvas,"mouseleave"),
                })

                if (!es.move) break
                var [_,e] = es.move
                if (e.which != 1) break
                
                var [xp,yp] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]
                send_message({"type": window.mode, "t":t, "rects":rects, "delta":[xp-x,yp-y]})

                for (var i in rects) {
                    window.selection[i][0] = rects[i][0] + xp - x
                    window.selection[i][1] = rects[i][1] + yp - y
                }
            }

        } else {
            // make a new selection

            if (!e.shiftKey) {
                window.selection = []
                draw()
            }
            
            const min_size = 3 // how much you need to drag before it is not considered a click
            var rect = [x,y,0,0]

            while (true) {
                var es = yield* any({
                    "move": event_listener(canvas,"mousemove"),
                    "up": event_listener(canvas,"mouseup"),
                    "leave": event_listener(canvas,"mouseleave"),
                })
                
                
                if (es.leave) {
                    var idx = window.selection.indexOf(rect)
                    if (idx > -1) rect.splice(idx,1)
                    draw()
                    break
                }
                if (es.up) break
                var [_,e] = es.move
                if (e.which != 1) break
                var [xp,yp] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]

                rect[0] = Math.min(x,xp)
                rect[1] = Math.min(y,yp)
                rect[2] = Math.max(x,xp) - rect[0]
                rect[3] = Math.max(y,yp) - rect[1]
                
                if (window.selection.indexOf(rect) == -1 && rect[2] >= min_size && rect[3] >= min_size) {
                    window.selection.push(rect)
                }
                draw()
            }
        }



    }
}

function* delete_loop() {
    while (true) {
        var [_, e] = yield* event_listener(window,"keydown")

        if (["move_split","move_simple"].indexOf(window.mode) == -1) continue
        if (e.ctrlKey && window.isHost) continue // avoid clash with clearing 
        if (e.key != "Delete") continue
        if (window.selection.length == 0) continue
        var t = Date.now()
        var rects = window.selection
        window.selection = []
        send_message({"type": "delete", "t":t, "rects":rects})
    }
}


function* saving_loop() {
    while (true) {
        var [_, e] = yield* event_listener(window,"keydown")
        if (!window.isHost) return
        if (!e.ctrlKey) continue
        
        if (e.shiftKey && e.code == "KeyS") {
            e.preventDefault()
            // save as
            save_and_sync()

            var new_name = prompt("Rename '"+window.saveKey+"' to:")
            while (true) {
                if (new_name === null) break
                if (window.localStorage[new_name] === undefined) break
                new_name = prompt("Name '"+new_name+"' already taken.\nRename '"+window.saveKey+"' to:")
            }
            if (new_name === null) continue
            
            window.localStorage[new_name] = window.localStorage[window.saveKey]
            delete window.localStorage[window.saveKey]
            console.log("Renamed '"+window.saveKey+"' to '"+window.new_name+"'.")
            window.saveKey = new_name

            continue
        }
        
        if (!e.shiftKey && e.code == "KeyS") {
            e.preventDefault()
            // regular save

            save_and_sync()

            continue
        }

        if (e.code == "KeyO") {
            e.preventDefault()
            
            // regular open
            save_and_sync()

            var s = "Currently editing '"+window.saveKey+"'.\nOpen save, or create new:"
            for (var i = 0; i < window.localStorage.length; i++) {
                s += "\n"+window.localStorage.key(i)
            }

            var new_name = prompt(s)
            if (new_name === null) continue

            window.saveKey = new_name

            if (window.localStorage[new_name] != undefined) {
                var data = JSON.parse(window.localStorage[window.saveKey])
            } else {
                var data = {"type":"state", "strokes":[], "texts":[]}
            }
            data["t"] = Date.now()
            send_message(data)
            console.log("Opened '"+window.saveKey+"'.")

            continue
        }

        if (e.key == "Delete") {
            e.preventDefault()

            // regular open

            if (confirm("Really clear '"+window.saveKey+"'?")) {
                var data = {"type":"state", "strokes":[], "texts":[]}
                data["t"] = Date.now()
                send_message(data)
                save_and_sync()
            }

            continue
        }

    }
}


// left click and drag as a pointer
function* cursor_loop() {


    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        return false
    })



    while (true) {
        var [_, e] = yield* event_listener(canvas,"mousedown")
        if (e.which != 3) continue
        var [x,y] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]
    
        
        var t = Date.now()
        send_message({"type": "cursor_begin","t":t, "color":window.cursorcolor, "x":x, "y":y})
        while (true) {
            var es = yield* any({
                "move": event_listener(canvas,"mousemove"),
                "up": event_listener(canvas,"mouseup"),
                "leave": event_listener(canvas,"mouseleave"),
            })

            if (!es.move) break
            var [_,e] = es.move
            if (e.which != 3) break
            
            if (Date.now() - t > 400) break // cant cursor for too long
            
            var [x,y] = [e.offsetX + window.pos.x, e.offsetY + window.pos.y]
            send_message({"type": "cursor_move","t":Date.now(), "target":t, "x":x, "y":y, "color":window.cursorcolor})
        }
    }
}


function* touch_loop() {

    var touch_positions = {}

    var timestamp = false
    while (true) {
        var es = yield* any({
            "start": event_listener(canvas,"touchstart"),
            "move": event_listener(canvas,"touchmove"),
            "end": event_listener(canvas,"touchend"),
            "cancel": event_listener(canvas,"touchcancel"),
        })

        if (es.start) var [_, e] = es.start
        if (es.move) var [_, e] = es.move
        if (es.end) var [_, e] = es.end
        if (es.cancel) var [_, e] = es.cancel

        e.preventDefault()
        
        var new_touch_positions = {}
        for (var touch of e.touches) {
            new_touch_positions[touch.identifier] = [touch.clientX, touch.clientY]

        }
        if (e.touches.length == 2) {
            var key = Math.min(...Object.keys(new_touch_positions))
            if (touch_positions[key] !== undefined) {
                var dx = new_touch_positions[key][0]- touch_positions[key][0]
                var dy = new_touch_positions[key][1] - touch_positions[key][1]

                window.pos.x -= dx
                window.pos.y -= dy
                window.summonpos.x = window.pos.x
                window.summonpos.y = window.pos.y
                draw()
            }
        }
        touch_positions = new_touch_positions


        if (es.start && e.touches.length == 1) {
            var touch = e.touches[0]
            var [x,y] = [touch.clientX + window.pos.x, touch.clientY + window.pos.y]
            timestamp = Date.now()
            send_message({"type": "cursor_begin","t":timestamp, "color":window.cursorcolor, "x":x, "y":y})
        }
        if (timestamp != false && es.move && e.touches.length == 1) {
            var touch = e.touches[0]
            var [x,y] = [touch.clientX + window.pos.x, touch.clientY + window.pos.y]
            send_message({"type": "cursor_move","t":Date.now(), "color":window.cursorcolor, "x":x, "y":y, "target":timestamp})
        }
        if (es.end || es.cancel) {
            timestamp = false
        }
        


    }

}
