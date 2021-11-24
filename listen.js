
/*

function* test() {
    while (true) {


        var [_, ...x] = yield* wait(2000)
        console.log("hi",x);
    }
}


function* test2() {
    yield* on_event("test_event_5")
    yield* on_event("test_event_6")
}
*/



const listeners = []
function launch(gen) {
    var val = gen.next()
    if (val.done == false) {
        listeners.push({"events": val.value,"generator": gen })
    }
}

function dispatch_event(name, ...args) {
    for (var i = listeners.length-1; i >= 0; i--) {
        var l = listeners.splice(i,1)[0]

        if (l["events"].indexOf(name) > -1) {
            var val = l["generator"].next([name].concat(args))
            if (val.done == false) {
                l["events"] = val.value
                listeners.splice(i,0,l)
            }
        } else {
            listeners.splice(i,0,l)
        }
    }
}

function* named_event(...names) {
    return yield names
}

var event_counter = 0
function make_event() {
    event_counter += 1
    return "event"+event_counter 
}


function* any(generators) {
    var events = {}
    for (key in generators) {
        var val = generators[key].next()
        if (val.done == false) {
            events[key] = val.value
        }
    }

    var out = {}

    while (true) {
        var all_events = []
        for (key in events) {
            for (e of events[key]) {     
                if (all_events.indexOf(e) == -1) {
                    all_events.push(e)
                }
            }
        }
       
        var [e, ...args] = yield all_events

        var should_stop = false
        
        for (key in events) {
            if (events[key].indexOf(e) > -1) {
                var val = generators[key].next([e].concat(args))
                if (val.done == false) {
                    events[key] = val.value
                } else {
                    out[key] = val.value
                    should_stop = true
                }
            }
        }

        if (should_stop) return out;
    }
}

function* all(generators) {
    var events = {}
    for (key in generators) {
        var val = generators[key].next()
        if (val.done == false) {
            events[key] = val.value
        }
    }

    var out = {}

    while (true) {
        var all_events = []
        for (key in events) {
            for (e of events[key]) {     
                if (all_events.indexOf(e) == -1) {
                    all_events.push(e)
                }
            }
        }
        
        var [e, ...args] = yield all_events
        
        for (key in events) {
            if (events[key].indexOf(e) > -1) {
                var val = generators[key].next([[e].concat(args)])
                if (val.done == false) {
                    events[key] = val.value
                } else {
                    delete events[key]
                    out[key] = val.value
                }
            }
        }
        
        if (Object.keys(events).length == 0) return out;
    }
}

var listener_cache = {}
function* event_listener(target,event_name) {
    if (listener_cache[event_name] != undefined) {
        for (var [targ,ev] of listener_cache[event_name]) {
            if (targ == target) {
                return yield [ev]
            }
        }
        var e = make_event()
        listener_cache[event_name].push([[target,e]])
    } else {
        var e = make_event()
        listener_cache[event_name] = [[target,e]]
    }

    target.addEventListener(event_name, function(...args) {
        dispatch_event(e, ...args)
    })
    return yield [e]
}

var on_cache = {}
function* on_event(target,event_name) {
    if (on_cache[event_name] != undefined) {
        for (var [targ,ev] of on_cache[event_name]) {
            if (targ == target) {
                return yield [ev]
            }
        }
        var e = make_event()
        on_cache[event_name].push([[target,e]])
    } else {
        var e = make_event()
        on_cache[event_name] = [[target,e]]
    }

    target.on(event_name, function(...args) {
        dispatch_event(e, ...args)
    })
    return yield [e]
}


function* wait(t) {
    const e = make_event()
    var t0 = Date.now()
    setTimeout(function() {
        dispatch_event(e, Date.now()-t0)
    },t)
    return yield [e]
}

////////////////////////////


/*
// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest

var xhttp = new XMLHttpRequest();

xhttp.open("GET", "ajax_info.txt")
xhttp.send()

yield* event_listener(xhttp, "load")


console.log(xhttp.response)

*/

