
// invoked by draw(). don't call directly.
function draw_menu() {
    var ctx = window.canvas.getContext("2d")

    ctx.textBaseline = "alphabetic"
    ctx.setTransform(1,0,0,1,0,0)
    ctx.fillStyle = "black"
    ctx.fillRect(0,window.canvas.height-30,400,30)
    ctx.lineWidth = 1
    ctx.lineCap = "square"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "white"
    ctx.beginPath()
    ctx.moveTo(0,window.canvas.height-30)
    ctx.lineTo(400,window.canvas.height-30)
    ctx.lineTo(400,window.canvas.height)
    ctx.stroke()

    ctx.fillStyle = "#444444"
    ctx.font = "16px sans"
    var pad = 10
    var x = pad
    for (var iter_mode of window.modes) {
        var s = iter_mode.charAt(0).toUpperCase() + iter_mode.slice(1)
        var w = ctx.measureText(s).width
        if (window.mode == iter_mode) {
            ctx.fillRect(x-2,window.canvas.height-25,w+4,20)
        }
        x += w+pad
    }

    ctx.fillStyle = "white"
    var x = pad
    for (var iter_mode of window.modes) {
        var s = iter_mode.charAt(0).toUpperCase() + iter_mode.slice(1)
        var w = ctx.measureText(s).width
        ctx.fillText(s,x,window.canvas.height-9)
        x += w+pad
    }

    /////////////////////////////////////////////// Pan buttons
    
    if (window.mode == "pan") {
        ctx.fillStyle = "black"
        ctx.fillRect(0,window.canvas.height-60.,250,30)


       
        ctx.fillStyle = "#AAA"
        ctx.font = "16px sans"
        var pad = 10
        var x = pad
        ctx.fillStyle = "white"
        var w = ctx.measureText("Summon").width
        ctx.fillText("Summon",x,window.canvas.height-40)
        x += w+pad
        ctx.fillStyle = "#AAA"
        var zoom = "Zoom: "+window.zoom_base
        var w = ctx.measureText(zoom).width
        ctx.fillText(zoom,x,window.canvas.height-40)
        x += w
        ctx.font = "10px sans"
        ctx.fillText(window.zoom,x,window.canvas.height-44)
        var w = ctx.measureText(window.zoom).width
        x += w+pad
        ctx.fillStyle = "white"
        ctx.font = "16px sans"
        var w = ctx.measureText("In").width
        ctx.fillText("In",x,window.canvas.height-40)
        x += w+pad
        var w = ctx.measureText("Out").width
        ctx.fillText("Out",x,window.canvas.height-40)
        x += w+pad

        ctx.lineWidth = 1
        ctx.lineCap = "square"
        ctx.lineJoin = "round"
        ctx.strokeStyle = "white"
        ctx.beginPath()
        ctx.moveTo(0,window.canvas.height-60)
        ctx.lineTo(x,window.canvas.height-60)
        ctx.lineTo(x,window.canvas.height-30)
        ctx.stroke()
    }


    /////////////////////////////////////////////// color swatches
   
    if (window.mode == "draw") {
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


    /////////////////////////////////////////////// save/load indicators
    
    if (window.mode == "save") {

        if (window.save_data.length == 0) {
            ctx.font = "16px sans"
            var pad = 10
            var x = pad
            var w = ctx.measureText("Click regions to save.").width

            ctx.fillStyle = "black"
            ctx.fillRect(0,window.canvas.height-60,(w+pad*2),30)

            ctx.fillStyle = "#AAA"
            ctx.fillText("Click a region to save.",x,window.canvas.height-40)

            x += w+pad

            ctx.lineWidth = 1
            ctx.lineCap = "square"
            ctx.lineJoin = "round"
            ctx.strokeStyle = "white"
            ctx.beginPath()
            ctx.moveTo(0,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-30)
            ctx.stroke()
        } else {
            ctx.font = "16px sans"
            var savetext = "Regions to save: "+window.save_data.length+"."
            var w1 = ctx.measureText(savetext).width
            var buttontext = "Download"
            var w2 = ctx.measureText(buttontext).width

            var pad = 10

            ctx.fillStyle = "black"
            ctx.fillRect(0,window.canvas.height-60,pad*3 + w1+w2,30)
            
            var x = pad
            ctx.fillStyle = "#AAA"
            ctx.fillText(savetext,x,window.canvas.height-40)
            x += w1+pad

            ctx.fillStyle = "white"
            ctx.fillText(buttontext,x,window.canvas.height-40)
            x += w2+pad
            
            ctx.lineWidth = 1
            ctx.lineCap = "square"
            ctx.lineJoin = "round"
            ctx.strokeStyle = "white"
            ctx.beginPath()
            ctx.moveTo(0,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-30)
            ctx.stroke()
        }



    }

    if (window.mode == "load") {


        if (window.load_data.length != 0) {
            var t = "Regions: "+window.load_data.length+". Click to place."

            ctx.font = "16px sans"
            var pad = 10
            var x = pad
            var w = ctx.measureText(t).width

            ctx.fillStyle = "black"
            ctx.fillRect(0,window.canvas.height-60,(w+pad*2),30)

            ctx.fillStyle = "#AAA"
            ctx.fillText(t,x,window.canvas.height-40)

            x += w+pad

            ctx.lineWidth = 1
            ctx.lineCap = "square"
            ctx.lineJoin = "round"
            ctx.strokeStyle = "white"
            ctx.beginPath()
            ctx.moveTo(0,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-30)
            ctx.stroke()
        } else {
            ctx.font = "16px sans"
            var savetext = "No regions to load."
            var w1 = ctx.measureText(savetext).width
            var buttontext = "Select file"
            var w2 = ctx.measureText(buttontext).width

            var pad = 10

            ctx.fillStyle = "black"
            ctx.fillRect(0,window.canvas.height-60,pad*3 + w1+w2,30)
            
            var x = pad
            ctx.fillStyle = "#AAA"
            ctx.fillText(savetext,x,window.canvas.height-40)
            x += w1+pad

            ctx.fillStyle = "white"
            ctx.fillText(buttontext,x,window.canvas.height-40)
            x += w2+pad
            
            ctx.lineWidth = 1
            ctx.lineCap = "square"
            ctx.lineJoin = "round"
            ctx.strokeStyle = "white"
            ctx.beginPath()
            ctx.moveTo(0,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-60)
            ctx.lineTo(x,window.canvas.height-30)
            ctx.stroke()
        }




    }




}


function mode_switch_events() {
    add_mouse_event("mousedown",false, function(p) {
        var [x,y] = p

        if (window.mode == "draw" && x < window.colors.length*30+10 && y > window.canvas.height - 60 && y < window.canvas.height-30) {
            var xp = 0
            for (var c of window.colors) {
                if ( Math.abs(xp+20 - x) < 10 ) window.color = c
                xp += 30
            }
            draw()
        }

        if (x > 400) return
        if (y < window.canvas.height - 30) return

        var ctx = window.canvas.getContext("2d")
        var pad = 10
        var x0 = pad
        for (var iter_mode of window.modes) {
            var s = iter_mode.charAt(0).toUpperCase() + iter_mode.slice(1)
            var w = ctx.measureText(s).width
            if (x0-2 < x && x < x0+w+2) window.mode = iter_mode
            x0 += w+pad
        }


        draw()
    })
}


function key_mode_events() {
    window.addEventListener("keydown", function(e) {
        if (window.mode == "text") return
        
        if (e.ctrlKey) {
            if (e.code == "KeyO") {
                e.preventDefault()
                window.mode = "load"
                draw()
            }
            if (e.code == "KeyS") {
                e.preventDefault()
                window.mode = "save"
                draw()
            }
            return
        }

        if (e.code == "KeyD" || e.code == "KeyB") {
            window.mode = "draw"
        }

        if (e.code == "KeyE") {
            window.mode = "erase"
        }

        if (e.code == "KeyT") {
            window.mode = "text"
        }

        if (e.code == "KeyM") {
            window.mode = "move"
        }

        draw()
    })
}

function mode_buttons() {
    add_mouse_event("mousedown",false, function(p) {
        var [px,py] = p
        var ctx = window.canvas.getContext("2d")

        if (window.mode == "pan") {
            if (px > 400) return
            if (py < window.canvas.height - 60) return
            if (py > window.canvas.height - 30) return

                
            ctx.font = "16px sans"
            var pad = 10
            var x = pad
            var w = ctx.measureText("Summon").width
            if (x <= px && px <= x + w) {
                var [posx,posy] = window.pos
                var [w,h] = [window.canvas.width,window.canvas.height]
                var zoomfactor = Math.pow(window.zoom_base, window.zoom)
                send_message({
                    "kind":"summon",
                    "pos":[posx + (w/2)/zoomfactor, posy + (h/2)/zoomfactor],
                })
                return
            }
            x += w+pad
            var zoom = "Zoom: "+window.zoom_base
            var w = ctx.measureText(zoom).width
            x += w
            ctx.font = "10px sans"
            var w = ctx.measureText(window.zoom).width
            x += w+pad
            ctx.font = "16px sans"
            var w = ctx.measureText("In").width
            if (x <= px && px <= x + w) {
                var zoomfactor = Math.pow(window.zoom_base, window.zoom)
                var [posx,posy] = window.pos
                var [w,h] = [window.canvas.width,window.canvas.height]
                var [cx,cy]  = [posx + (w/2)/zoomfactor, posy + (h/2)/zoomfactor]

                window.zoom += 1

                var zoomfactor = Math.pow(window.zoom_base, window.zoom)
                window.pos = [cx - (w/2)/zoomfactor , cy - (h/2)/zoomfactor]
                window.summonpos = [window.pos[0],window.pos[1]]


                draw()
                return
            }
            x += w+pad
            var w = ctx.measureText("Out").width
            if (x <= px && px <= x + w) {

                var zoomfactor = Math.pow(window.zoom_base, window.zoom)
                var [posx,posy] = window.pos
                var [w,h] = [window.canvas.width,window.canvas.height]
                var [cx,cy]  = [posx + (w/2)/zoomfactor, posy + (h/2)/zoomfactor]

                window.zoom -= 1

                var zoomfactor = Math.pow(window.zoom_base, window.zoom)
                window.pos = [cx - (w/2)/zoomfactor , cy - (h/2)/zoomfactor]
                window.summonpos = [window.pos[0],window.pos[1]]

                draw()
                return
            }
        }


        if (window.mode == "save") {
            if (px > 400) return
            if (py < window.canvas.height - 60) return
            if (py > window.canvas.height - 30) return

            var t = "Regions: "+window.save_data.length+". Click to place."
            var pad = 10

            var savetext = "Regions to save: "+window.save_data.length+"."
            var buttontext = "Download"

            var w1 = ctx.measureText(savetext).width
            var w2 = ctx.measureText(buttontext).width
            
            if (2*pad + w1 <= px && px <= 3*pad + w1 + w2) {

                var date = new Date()
                var date_string = ""
                if (date.getFullYear() % 100 < 10) date_string += "0"+ (date.getFullYear() % 100)
                else date_string += (date.getFullYear() % 100)
                if (date.getMonth() < 10) date_string += "0"+ date.getMonth()
                else date_string += date.getMonth()
                if (date.getDate() < 10) date_string += "0"+ date.getDate()
                else date_string += date.getDate()


                var time_string = ""
                if (date.getHours() < 10) time_string += "0"+ date.getHours()
                else time_string += date.getHours()
                if (date.getMinutes() < 10) time_string += "0"+ date.getMinutes()
                else time_string += date.getMinutes()
                
                
                var out = []
                for (var i in window.save_data) {
                    var region = {}    
                    for (var ch in window.save_data[i]) {
                        region[ch] = Array.from(window.save_data[i][ch].data)
                    }
                    out.push(region)
                }

                var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(out))
                var dlAnchorElem = document.createElement("a")
                dlAnchorElem.setAttribute("href", dataStr)
                dlAnchorElem.setAttribute("download", date_string+"_blackboard_"+time_string+".json")
                dlAnchorElem.click()


                window.save_data = []

                draw()
                return
            }

        }


        if (window.mode == "load") {
            if (px > 400) return
            if (py < window.canvas.height - 60) return
            if (py > window.canvas.height - 30) return


            var t = "Regions: "+window.load_data.length+". Click to place."
            var pad = 10
            var savetext = "No regions to load."
            var w1 = ctx.measureText(savetext).width
            var buttontext = "Select file"
            var w2 = ctx.measureText(buttontext).width
            
            if (2*pad + w1 <= px && px <= 3*pad + w1 + w2) {

                var el = document.createElement("input")
                el.type = "file"
                el.addEventListener("change", function() {
                    if (el.files.length == 0) return
                    var f = el.files[0]
                    if (f.type != "application/json") {
                        alert("Invalid file type "+f.type+". Expected 'application/json'.")
                        return
                    }
                    
                    f.text().then(function(text) {
                        var dat = JSON.parse(text)
                        window.load_data = []

                        for (var i in dat) {

                            var [mx,my] = [0,0]
                            var count = 0
                            for (var ch in dat[i]) {
                                var [cx,cy] = JSON.parse("["+ch+"]")
                                mx += cx
                                my += cy
                                count += 1
                            }
                            var [mx,my] = chunk_for_point([mx/count, my/count])

                            var region = {}
                            for (var ch in dat[i]) {
                                var [cx,cy] = JSON.parse("["+ch+"]")
                                region[[cx-mx,cy-my]] = new ImageData(new Uint8ClampedArray(dat[i][ch]), window.chunk_size)
                            }
                            window.load_data.push(region)
                        }
                        window.load_highlight = {}
                        draw()
                    })

                })
                el.click()

                return
            }

        }



    })
}


function in_menu_region(p, correct) {
    var [x,y] = p
    if (correct) {
        var [px,py] = window.pos
        var zoomfactor = Math.pow(window.zoom_base, window.zoom)
        var [x,y] = [(x - px)*zoomfactor, (y - py)*zoomfactor ] 
    }

    if (x > 400) return false
    if (window.mode == "pan" || window.mode == "save" || window.mode == "load" || window.mode == "draw") {
        return (y > window.canvas.height - 60)
    } else {
        return (y > window.canvas.height - 30)
    }
}
