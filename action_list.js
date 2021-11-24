
function send_message(msg) {
    receive_message(msg)
    for (var id in window.friendsConns) {
        window.friendsConns[id].send(msg)
    }
}

// Data for drawing
// window.strokes = []    // list of strokes, each is {"points":[[x,y],[x,y],[x,y]], "color":"#101010"}
// window.text  = []      // list of texts, each is {"x":x, "y":y, "text":"Hello world", "t":timestamp}
// window.latex  = []      // list of latex, each is {"x":x, "y":y, "text":"1+1", "t":timestamp}

// window.action_list = [] // kept in order automatically (insert via binary search for example)
// window.action_hash = {} // indexed by timestamps

// {"t":<timestamp>, "type":"stroke", "points":[[x,y],[x,y]], "color":"#101010" }
// messages:
//      {"type": "stroke_point", "t":<timestamp>, "p":[x,y], "color":"#101010"}             
//              # a point was drawn: add it to the action list with that timestamp
//      {"type": "stroke_finish", "t":<timestamp>, "ps":[[x,y],[x,y]] , "color":"#101010"}  
//              # a line was finished: replace the action's points with that list.

// {"t":<timestamp>, "type":"erase_split/simple", "points":[[x,y],[x,y]] }
// "erase_point" and "erase_finish". Similar concepts.

//  {"t":<timestamp>, "type":"insert_text", "p":[x,y], "text":"Hello world!"  }
//  {"t":<timestamp>, "type":"modify_text", "text":"Hello sailor!", "target":<timestamp>}
//  to delete a textbox, modify its text to be empty, or something that trims to ""

// {"t":<timestamp>, "type":"move_split/simple", "rects":[[x,y,w,h],[x,y,w,h]], "delta":[x,y] }
//      {"type": "move_split/simple", "t":<timestamp>, "rects":[[x,y,w,h],[x,y,w,h]], "delta":[x,y]}             
//              # updates the action with that timestamp. 
//              # new action is created for each drag operation

// {"t":<timestamp>, "type":"delete", "rects":[[x,y,w,h],[x,y,w,h]] }


// {"t":<timestamp>, "type":"state", "strokes":[{"color":"#101010", "ps":[[x,y],[x,y]]}], "texts":[{"text":"hello world", "p":[x,y], "t":<timestamp>}] }
// Sent out by the host once in a while, usually for a timestamp that's a bit in the past
// Resets deletes all actions before or at that timestamp.

    // {"t":<timestamp>, "pts":[[x,y,t],[x,y,t]], "color":"#303030"}
    //    {"t":<timestamp>, "type":"cursor_begin", "x":x, "y":y, "color":"#303030"}
    //    {"t":<timestamp>, "type":"cursor_move", "x":x, "y":y, "target":<timestamp>}


// {"type":"summon", "x":x, "y":y}

// if the timestamp t does not exist, it creates a dict with just the stamp and returns true
function create_timestamp(t) {
    if (window.action_hash[t] !== undefined) return false
    window.action_hash[t] = {"t":t}

    var idx = 0
    while (true) {
        if (idx >= window.action_list.length) {
            window.action_list.push(window.action_hash[t])
            return true
        }
        if (window.action_list[idx]["t"] > t) {
            window.action_list.splice(idx,0,window.action_hash[t])
            return true
        }
        idx += 1
    }
}


function receive_message(msg) {
    var t = msg["t"]
    if (msg["type"] == "stroke_point") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "stroke"
            window.action_hash[t]["points"] = []
            window.action_hash[t]["color"] = msg["color"]
        }
        window.action_hash[t]["points"].push(msg["p"])
    }

    if (msg["type"] == "stroke_finish") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "stroke"
        }
        window.action_hash[t]["color"] = msg["color"]
        window.action_hash[t]["points"] = msg["points"]
    }

    if (msg["type"] == "erase_split_point") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "erase_split"
            window.action_hash[t]["points"] = []
        }
        window.action_hash[t]["points"].push(msg["p"])
    }

    if (msg["type"] == "erase_split_finish") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "erase_split"
        }
        window.action_hash[t]["points"] = msg["points"]
    }

    if (msg["type"] == "erase_simple_point") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "erase_simple"
            window.action_hash[t]["points"] = []
        }
        window.action_hash[t]["points"].push(msg["p"])
    }

    if (msg["type"] == "erase_simple_finish") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "erase_simple"
        }
        window.action_hash[t]["points"] = msg["points"]
    }

    if (msg["type"] == "insert_text") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "insert_text"
        }
        window.action_hash[t]["text"] = msg["text"]
        window.action_hash[t]["p"] = msg["p"]
    }
    
    if (msg["type"] == "modify_text") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "modify_text"
        }
        window.action_hash[t]["text"] = msg["text"]
        window.action_hash[t]["target"] = msg["target"]
    }


    if (msg["type"] == "move_split") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "move_split"
        }
        window.action_hash[t]["rects"] = msg["rects"]
        window.action_hash[t]["delta"] = msg["delta"]
    }

    if (msg["type"] == "move_simple") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "move_simple"
        }
        window.action_hash[t]["rects"] = msg["rects"]
        window.action_hash[t]["delta"] = msg["delta"]
    }

    if (msg["type"] == "delete") {
        if (create_timestamp(t)) {
            window.action_hash[t]["type"] = "delete"
        }
        window.action_hash[t]["rects"] = msg["rects"]
    }

    if (msg["type"] == "state") {
        var new_action_hash = {}
        var new_action_list = []
       
        
        new_action_list.push(msg)
        new_action_hash[msg["t"]] = msg

        for (var action of window.action_list) {
            if (action["t"] <= msg["t"]) continue
            new_action_list.push(action)
            new_action_hash[action["t"]] = action
        }

        window.action_list = new_action_list
        window.action_hash = new_action_hash
    }

    // {"t":<timestamp>,  "pts":[[x,y,t],[x,y,t]], "color":"#303030"}
    //    {"t":<timestamp>, "type":"cursor_begin", "x":x, "y":y, "color":"#303030"}
    //    {"t":<timestamp>, "type":"cursor_move", "x":x, "y":y, "target":<timestamp>, "color":"#303030"}

    if (msg["type"] == "cursor_begin") {
        window.cursor_actions.push({
            "t": msg["t"],
            "pts": [[msg["x"],msg["y"],Date.now()]],
            "color": msg["color"]
        })
    }
    
    if (msg["type"] == "cursor_move") {
        var found = false
        var t = msg["t"]
        t = Date.now() // an attempt to hack the issue where long lines dissappear
        for (var action of window.cursor_actions) {
            if (action["t"] == msg["target"]) {
                action["pts"].push([msg["x"],msg["y"],t])
                found = true
                break
            }
        }
        if (!found) window.cursor_actions.push({
            "t": msg["target"],
            "pts": [[msg["x"],msg["y"],t]],
            "color": msg["color"]
        })
    }

    if (msg["type"] == "summon") {
        window.summonpos.x = msg["x"] - window.innerWidth/2
        window.summonpos.y = msg["y"] - window.innerHeight/2
    }


    compute_state()
    draw()
}



function compute_state() {
    window.strokes = []
    window.text = []
    window.latex = []
    window.text_rects = []
    

    const erasor_radius_sq = 100

    for (var action of window.action_list) {
        
        if (action["type"] == "stroke") {
            window.strokes.push({"points":action["points"], "color":action["color"]})
        }

        if (action["type"] == "erase_simple") {
            var new_strokes = []
            for (var stroke of window.strokes) {
                var hit = false
                for (e_pt of action["points"]) {
                    for (s_pt of stroke["points"]) {
                        if ( Math.pow(e_pt[0]-s_pt[0],2) + Math.pow(e_pt[1]-s_pt[1],2) < erasor_radius_sq ) {
                            hit = true
                            break
                        }
                    }
                    if (hit) break
                }
                if (!hit) new_strokes.push(stroke)
            }
            window.strokes = new_strokes
        }

        if (action["type"] == "erase_split") {
            var new_strokes = []
            for (var stroke of window.strokes) {
                var l = []
                for (s_pt of stroke["points"]) {

                    var hit = false
                    for (e_pt of action["points"]) {
                        if ( Math.pow(e_pt[0]-s_pt[0],2) + Math.pow(e_pt[1]-s_pt[1],2) < erasor_radius_sq ) {
                            hit = true
                            break
                        }
                    }

                    if (hit) {
                        if (l.length > 0) new_strokes.push({"points":l, "color":stroke["color"]})
                        l = []
                    } else {
                        l.push(s_pt)
                    }
                }
                if (l.length > 0) new_strokes.push({"points":l, "color":stroke["color"]})
            }
            window.strokes = new_strokes
        }

        function set_text_rect_dims(text_rect) {
            var w = 0
            var h = 0

            var full_text = text_rect["text"]
            var latex = false

            for (var text of full_text.split("$")) {
                if (latex) {
                    if (window.latexCache[text] === undefined) {
                        latex = !latex
                        continue
                    }
                    var img = window.latexCache[text]
                    w += img.width*window.latexScale
                    if (h < img.height*window.latexScale) h = img.height*window.latexScale
                } else {
                    var ctx = window.canvas.getContext("2d")
                    ctx.font = window.font
                    var m = ctx.measureText(text)
                    w += m.width
                    var this_h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
                    if (h < this_h) h = this_h
                }
                latex = !latex
            }

            text_rect["w"] = w
            text_rect["h"] = h
        }


        if (action["type"] == "insert_text") {
            var text_rect = {
                "x":action["p"][0], "y":action["p"][1],
                "w":0, "h":0,
                "t":action["t"], 
                "text":action["text"]
            }

            set_text_rect_dims(text_rect)

            window.text_rects.push(text_rect)

        }

        if (action["type"] == "modify_text") {
            var new_text_rects = []
            for (var text_rect of window.text_rects) {
                if (text_rect["t"] != action["target"]) {
                    new_text_rects.push(text_rect)
                    continue
                }
                if (action["text"].trim() == "") continue
                text_rect["text"] = action["text"]
                set_text_rect_dims(text_rect)
                new_text_rects.push(text_rect)
            }
            window.text_rects = new_text_rects
        }

        if (action["type"] == "move_split") {

            function point_hit(pt,action) {
                for (var rect of action["rects"]) {
                    if (rect[0] <= pt[0] && pt[0] <= rect[0] + rect[2] &&
                        rect[1] <= pt[1] && pt[1] <= rect[1] + rect[3]) {
                        return true
                    }
                }
                return false
            }

            var new_strokes = []
            for (var stroke of window.strokes) {
                var state = false
                var l = []
                for (s_pt of stroke["points"]) {
                    var hit = point_hit(s_pt,action)
                    if (hit != state && l.length > 0) {
                        new_strokes.push({"points":l, "color":stroke["color"]})
                        l = []
                    }
                    state = hit
                    if (hit) {
                        l.push([s_pt[0]+action["delta"][0],s_pt[1]+action["delta"][1]])
                    } else {
                        l.push(s_pt)
                    }
                } 
                if (l.length > 0) new_strokes.push({"points":l, "color":stroke["color"]})
            }
            window.strokes = new_strokes


            // move the text if it is entirely contained within one of the selections
            for (var text_rect of window.text_rects) {
                var hit = false
                for (var rect of action["rects"]) {
                    if (rect[0] <= text_rect["x"] && text_rect["x"] + text_rect["w"] <= rect[0] + rect[2] &&
                        rect[1] <= text_rect["y"] && text_rect["y"] + text_rect["h"] <= rect[1] + rect[3]) {
                        hit = true
                        break
                    }
                }
                
                if (hit) {
                    text_rect["x"] += action["delta"][0]
                    text_rect["y"] += action["delta"][1]
                }
            }
        }


        if (action["type"] == "move_simple") {
            var new_strokes = []
            for (var stroke of window.strokes) {
                var l = []

                var hit = false
                for (s_pt of stroke["points"]) {
                    l.push([s_pt[0]+action["delta"][0],s_pt[1]+action["delta"][1]])

                    if (hit) continue
                    for (var rect of action["rects"]) {
                        if (rect[0] <= s_pt[0] && s_pt[0] <= rect[0] + rect[2] &&
                            rect[1] <= s_pt[1] && s_pt[1] <= rect[1] + rect[3]) {
                            hit = true
                            break
                        }
                    }
                } 
            
                if (hit) new_strokes.push({"points":l, "color":stroke["color"]})
                else new_strokes.push(stroke)
            }
            window.strokes = new_strokes

            // move the text if any of the rects intersect even partially
            for (var text_rect of window.text_rects) {
                var hit = false
                for (var rect of action["rects"]) {
                    if (text_rect["x"] + text_rect["w"] < rect[0]) continue
                    if (rect[0] + rect[2] < text_rect["x"]) continue
                    if (text_rect["y"] + text_rect["h"] < rect[1]) continue
                    if (rect[1] + rect[3] < text_rect["y"]) continue
  
                    hit = true
                    break
                }
                
                if (hit) {
                    text_rect["x"] += action["delta"][0]
                    text_rect["y"] += action["delta"][1]
                }
            }

        }

        if (action["type"] == "delete") {
            function point_hit(pt,action) {
                for (var rect of action["rects"]) {
                    if (rect[0] <= pt[0] && pt[0] <= rect[0] + rect[2] &&
                        rect[1] <= pt[1] && pt[1] <= rect[1] + rect[3]) {
                        return true
                    }
                }
                return false
            }

            var new_strokes = []
            for (var stroke of window.strokes) {
                var state = false
                var l = []
                for (s_pt of stroke["points"]) {
                    var hit = point_hit(s_pt,action)
                    if (hit != state && l.length > 0) {
                        new_strokes.push({"points":l, "color":stroke["color"]})
                        l = []
                    }
                    state = hit
                    if (!hit) l.push(s_pt)
                } 
                if (l.length > 0) new_strokes.push({"points":l, "color":stroke["color"]})
            }
            window.strokes = new_strokes


            // delete text if it is entirely contained within one of the selections
            var new_text_rects = []
            for (var text_rect of window.text_rects) {
                var hit = false
                for (var rect of action["rects"]) {
                    if (rect[0] <= text_rect["x"] && text_rect["x"] + text_rect["w"] <= rect[0] + rect[2] &&
                        rect[1] <= text_rect["y"] && text_rect["y"] + text_rect["h"] <= rect[1] + rect[3]) {
                        hit = true
                        break
                    }
                }
                
                if (!hit) new_text_rects.push(text_rect)
            }
            window.text_rects = new_text_rects
        }

        // {"t":<timestamp>, "type":"state", "strokes":[{"color":"#101010", "ps":[[x,y],[x,y]]}], "texts":[{"text":"hello world", "p":[x,y], "t":<timestamp>}] }
        if (action["type"] == "state") {
            window.strokes = []
            window.text_rects = []

            for (var stroke of action["strokes"]) {
                window.strokes.push({"points":stroke["ps"], "color":stroke["color"]})
            }

            for (var text of action["texts"]) {
                var text_rect = {
                    "x":text["p"][0], "y":text["p"][1],
                    "w":0, "h":0,
                    "t":text["t"], 
                    "text":text["text"]
                }
                set_text_rect_dims(text_rect)
                window.text_rects.push(text_rect)
            }
        }

    }

    // process the text
    for (var text_rect of window.text_rects) {
        if (window.selected_text == text_rect["t"]) {
            window.textbox.style.left = text_rect["x"] - window.pos.x
            window.textbox.style.top = text_rect["y"] - window.pos.y
            continue
        }

        var x = text_rect["x"]
        var y = text_rect["y"] 
        var rect_text = text_rect["text"]
        var latex = false

        for (var text of rect_text.split("$")) {
            if (latex) {
                if (window.latexCache[text] === undefined) {
                    launch(cacheLatex(text))
                    latex = !latex
                    continue
                }

                var img = window.latexCache[text]
                window.latex.push({
                    "t":action["t"],
                    "x":x,"y":y+text_rect["h"]-img.height*window.latexScale,
                    "text":text
                })

                x += img.width*window.latexScale
            } else {
                window.text.push({
                    "t":action["t"],
                    "x":x,"y":y+text_rect["h"],
                    "text":text
                })
                var ctx = window.canvas.getContext("2d")
                ctx.font = window.font
                
                var m = ctx.measureText(text)
                x += m.width
            }
            latex = !latex
        }

    }


}
