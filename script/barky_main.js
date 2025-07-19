// this file stores various personal functions and classes.

let posmod = (dividend, divisor) => (((dividend % divisor) + divisor) % divisor);
let posremainder = (dividend, divisor) => posmod(dividend, divisor);
// remaindering can often return negative numbers at times when it's a pain in
// the ass to account for those and the positive/negative difference doesn't
// actually matter. so. this will always return a positive remainder. if
// dividend % 7 would return -2, it'll return 5 instead.
function roundspecial(num, places, func) {
// rounds a number to the nearest 10**places. 0 is the normal round, -1 is
// .1, 1 is 10.
// - the default places is -10, .0000000001. to combat rounding errors.
// - func is the string for which Math function you want to run on them.
//   "round" is the default, but you can use floor or ceil.
    places ??= -10;
    func ??= "round";
    return Math[func](num*(10**(-places))) / 10**(-places);
};
function epsilon(factor) {
    return 10**(-(factor ?? 10));
};
let invertboolean = (original, condition) => (condition ? !original : original);
// i could do this by evaluating the boolean and using an if else but you
// know what? that shit isn't elegant at all.
// - by "condition" i mean the condition for the inversion. it should be
//   another boolean.
function xor(...booleans) {
    let value = false;
    booleans.forEach(function(element) {
        value = element ? !value : value;
    });
    return value;
};
//
function compareobject(object1, object2) {
// deep comparison of two objects. (=== returns false unless one object is a
// reference to the other.)
    let i1 = 0;
    let isobject = (object) => (typeof object === "object" && !Array.isArray(object) && object);
    if(typeof object1 !== "object" && typeof object2 !== "object") {
        return object1 === object2;
    }
    else if(object1 === null && object2 === null) {
        return true;
    }
    else if(Array.isArray(object1) && Array.isArray(object2)) {
        if(object1.length !== object2.length) {
            return false;
        };
        for(i1 = 0; i1 < object1.length; i1++) {
            if(!compareobject(object1[i1], object2[i1])) {
                return false;
            };
        }
    }
    else if(
        object1 === null || object2 === null
        ||
        typeof object1 !== "object" || typeof object2 !== "object"
        ||
        Array.isArray(object1) || Array.isArray(object2)
    ) {
        return false;
    }
    else {
    // if it's actually an object
        if(!compareobject(Object.keys(object1), Object.keys(object2))) {
        // .keys is an array, so i can use recursion
            return false;
        };
        for (i1 in object1) {
            if(object1.hasOwnProperty(i1) && !compareobject(object1[i1], object2[i1])) {
                return false;
            };
        }
    };
    return true;
}
function objectisempty(object) {
// checks if the object has no properties or only has objects that
// are themselves empty.
// - used it with Poses. this is a useful function for objects like
//   that that store changes. if you use this to delete any empties,
//   you can clear out a lot of clutter.
    let i1 = "";
    for (i1 in object) {
        if (object.hasOwnProperty(i1) && (object[i1] === null || typeof object[i1] !== "object" || !objectisempty(object[i1]))) {
            return false;
        }
    }
    return true;
}
//
function circledraw(ctx, x, y, radius, fill, color, loop) {
// - fill is a boolean
// - NOTE: this will draw circles as one wider than they should be. (in
//   other words, diameter is measured from the center of the outline to the
//   center of the outline, not outer edge to outer edge.)
//   - the additional pixels will be on the right and bottom, the positive
//     directions
//   - this is not true for fill.
// - TODO
//   - make it so radius can be an array, to make it draw ellipses
//   - split it up into a circleexecute function, like what i did for
//     nonaaline
//     - code is a function with the parameters ctx, x, y, weight.
//       - weight is a value from 0 to 1, 0 being a coordinate in the center
//         and 1 being a coordinate at the edge
//     - however, fill circles work by drawing a fillRect that goes from one
//       end to the other instead of pixel by pixel... there should be a
//       special parameter that makes it keep working like this so as not to
//       make it more tedious/intensive than it has to be
//     - also the stroke circle doesn't run in a circle. it translates every
//       x coordinate into two y coordinates, then every y coordinate into
//       two x coordinates. that means it'll run on the same pixel twice a
//       lot of the time, and it probably doesn't run in the order the user
//       would like.
//     =
//     - once you do this:
//     - change suite.polaris so that it works off of how many pixels there
//       are for a circle of that size rather than the circumference
// =
// moved from reusables
    // gotta flip the axes so it goes row by row for whichever radius is
    // higher
    // - replace every instance
    // - keep the default
    let xradius = null;
    let yradius = null;
    let i1 = 0;
    let i2 = 0;
    if(Array.isArray(radius) && radius.length >= 2) {
        xradius = .5*Math.round(radius[0]/.5);
        yradius = .5*Math.round(radius[1]/.5);
        if(xradius%1 === 0) {
            x = Math.round(x);
        }
        else {
            x = Math.round(x + .5) - .5;
        };
        if(yradius%1 === 0) {
            y = Math.round(y);
        }
        else {
            y = Math.round(y + .5) - .5;
        };
    }
    else {
        radius = .5*Math.round(radius/.5);
        // round to the nearest .5 number
        if(radius%1 === 0) {
            x = Math.round(x);
            y = Math.round(y);
        }
        else {
            x = Math.round(x + .5) - .5;
            y = Math.round(y + .5) - .5;
        };
        // if it's a .5, make these .5s too. otherwise, go with whole numbers
        /*
        x = .5*Math.round(x/.5);
        y = .5*Math.round(y/.5);
        //if(radius.length) {
        //xradius = radius[0];
        //yradius = radius[1];
        //}
        //else {
        radius = .5*Math.round(radius/.5);
        //};
        //*/
        if(x%1 === y%1 && radius%1 !== x%1) {
            radius += .5;
        };
        // if the coordinates +/- the radius is not an integer, it'll be
        // misshapen.
        xradius = radius;
        yradius = radius;
    };
    radius = null;
    // so that i can't leave in any errors... it's supposed to use xradius
    // and yradius exclusively unless i forget something
    if(!color) {
        if(fill) {
            color = ctx.fillStyle;
        }
        else {
            color = ctx.strokeStyle;
        };
    };
    let fillstyletemp = ctx.fillStyle;
    let cd_x = 0;
    let cd_y = 0;
    ctx.fillStyle = color;
    if(fill) {
        let cd_w = 0;
        let axisswitch = false;
        if(xradius > yradius) {
            xradius = [xradius, yradius];
            yradius = xradius[0];
            xradius = xradius[1];
            x = [x, y];
            y = x[0];
            x = x[1];
            // switch the values
            axisswitch = true;
        };
        for(i1 = (y - yradius); i1 < (y + yradius); i1++){
            cd_y = Math.round(i1);
            cd_w = Math.asin((i1 - y + .5)/yradius);
            // use asin on the ratio between the y position and the radius
            // to find the angle (or an angle with the same cosine, anyway)
            cd_w = Math.cos(cd_w)*xradius;
            // use cosine and radius on it to find the distance from the
            // center to the left/right edges at this height
            // - despite the variable name, for now it's only half of the
            //   width.
            cd_x = Math.round(x - cd_w);
            cd_w = (x + cd_w) - .5;
            if(cd_w <= .5) {
                cd_w = Math.floor(cd_w);
            }
            else {
                cd_w = Math.ceil(cd_w);
            };
            // if the coordinate for the left edge is a .5, chances are the
            // right edge is a .5 too. so in order for it to be
            // symmetrical, it has to invert what happens for .5 numbers.
            cd_w -= cd_x;
            if(axisswitch) {
                ctx.fillRect(cd_y, cd_x, 1, cd_w);
            }
            else {
                ctx.fillRect(cd_x, cd_y, cd_w, 1);
            };
            // the reason this was hard was because by default, coordinates
            // refer to the top left corner of a pixel, but it needs to use
            // the center for this.
            // - it was surprisingly difficult to get it to do that.
            // - an important note is that y doesn't have to be .5ed unless
            //   it's being used in an equation. the only thing y does is
            //   provide a coordinate for fillRect. and the drawing is a
            //   1-pixel-tall rectangle that starts at y. divide 1 in half.
            //   - that's also why the for loop condition is < instead of
            //     <=. once it's ===, the y coordinate is already at the
            //     bottom of the circle, so it shouldn't draw another
            //     rectangle.
        }
    }
    else {
        for(i1 = (x - xradius); i1 <= (x + xradius); i1++){
            cd_x = Math.round(i1);
            cd_y = Math.acos((i1-x)/xradius);
            cd_y = Math.sin(cd_y)*yradius;
            cd_y = [Math.round(y + cd_y), Math.round(y - cd_y)];
            if(loop) {
                cd_x = posmod(cd_x, ctx.canvas.width);
                cd_y[0] = posmod(cd_y[0], ctx.canvas.height);
                cd_y[1] = posmod(cd_y[1], ctx.canvas.height);
            };
            ctx.fillRect(cd_x, cd_y[0], 1, 1);
            ctx.fillRect(cd_x, cd_y[1], 1, 1);
        }
        for(i1 = (y - yradius); i1 <= (y + yradius); i1++){
            cd_y = Math.round(i1);
            cd_x = Math.acos((i1-y)/yradius);
            cd_x = Math.sin(cd_x)*xradius;
            cd_x = [Math.round(x + cd_x), Math.round(x - cd_x)];
            if(loop) {
                cd_y = posmod(cd_y, ctx.canvas.height);
                cd_x[0] = posmod(cd_x[0], ctx.canvas.width);
                cd_x[1] = posmod(cd_x[1], ctx.canvas.width);
            };
            ctx.fillRect(cd_x[0], cd_y, 1, 1);
            ctx.fillRect(cd_x[1], cd_y, 1, 1);
        }
    }
    ctx.fillStyle = fillstyletemp;
}
function dither_interpreter(name, x, y, invert) {
    let dith = dithers[name];
    return invertboolean((
        dith.hasOwnProperty("period")
        ?
        dith.func(posmod(x, dith.period.x), posmod(y, dith.period.y))
        :
        dith.func(x, y)
    ), invert);
};
const dithers = {
    none: {
        func: (x, y) => true,
    },
    "3x3 dots": {
        func: (x, y) => x === 1 && y === 1,
        period: {
            x: 3,
            y: 3,
        },
    },
    "2x2 dots": {
        func: (x, y) => x === 0 && y === 0,
        period: {
            x: 2,
            y: 2,
        },
    },
    vertical: {
        func: (x, y) => x === 1,
        period: {
            x: 2,
            y: 1,
        },
    },
    horizontal: {
        func: (x, y) => y === 1,
        period: {
            x: 1,
            y: 2,
        },
    },
    checker: {
        func: (x, y) => (x + y === 1),
        period: {
            x: 2,
            y: 2,
        },
    },
    "x grid": {
        func: (x, y) => (
            (x + y)%4 === 0
            ||
            Math.abs(x - y) === 2
        ),
        period: {
            x: 4,
            y: 4,
        },
    },
    pythagorean: {
        func: (x, y) => (
            (
                y%2 === 0
                &&
                x !== (7 + 2*y)%10
                &&
                x !== (8 + 2*y)%10
                &&
                x !== (9 + 2*y)%10
            )
            ||
            (
                x%2 === 0
                &&
                y !== (5 + 3*x)%10
                &&
                y !== (6 + 3*x)%10
                &&
                y !== (7 + 3*x)%10
            )
        ),
        period: {
            x: 10,
            y: 10,
        },
    },
    "noise 1/64": {
        func: (x, y) => Math.random() < 1/64,
        erases: true,
    },
    "noise 1/4": {
        func: (x, y) => Math.random() < 1/4,
        erases: true,
    },
    "noise 1/2": {
        func: (x, y) => Math.random() < 1/2,
        erases: true,
    },
    triangle: {
        func: (x, y) => (x + y <= 2),
        period: {
            x: 4,
            y: 4,
        },
    },
    hardware: {
        func: (x, y) => (Math.floor(x/3) === Math.floor(y/3) ? x : y)%3 === 1,
        period: {
            x: 6,
            y: 6,
        },
    },
    "2x2 squared": {
        func: (x, y) => (
            x%2 === 1
            &&
            y%2 === 1
            &&
            (
                x === 3
                ||
                y === 3
            )
        ),
        period: {
            x: 4,
            y: 4,
        },
    },
    pinwheel: {
        func: (x, y) => (
            (
                Math.floor(x/2) === 0
                &&
                Math.floor(y/2) === 0
                &&
                x%2 === 0
            )
            ||
            (
                Math.floor(x/2) === 1
                &&
                Math.floor(y/2) === 0
                &&
                y%2 === 0
            )
            ||
            (
                Math.floor(x/2) === 0
                &&
                Math.floor(y/2) === 1
                &&
                y%2 === 1
            )
            ||
            (
                Math.floor(x/2) === 1
                &&
                Math.floor(y/2) === 1
                &&
                x%2 === 1
            )
        ),
        period: {
            x: 4,
            y: 4,
        },
    },
    "hex dot": {
        func: (x, y) => (
            (
                x === 4
                &&
                y%4 === 0
                &&
                Math.floor(y/4) !== 1
            )
            ||
            (
                x === 0
                &&
                y%4 === 2
                &&
                Math.floor(y/4) !== 2
            )
        ),
        period: {
            x: 8,
            y: 12,
        },
    },
    honeycomb: {
        func: (x, y) => (
            (
                x === 0
                &&
                y >= 2
                &&
                y < 7
            )
            ||
            (
                x%4 === 2
                &&
                y%6 === 1
            )
            ||
            (
                x%6 === 1
                &&
                y%4 === 2
                &&
                y < 8
            )
            ||
            (
                x >= 3
                &&
                x < 6
                &&
                y%8 === 0
            )
            ||
            (
                x === 4
                &&
                y >= 8
            )
        ),
        period: {
            x: 8,
            y: 12,
        },
    },
    sierpinski: {
        func: (x, y) => (
            (Math.floor(x/3) === 1 && Math.floor(y/3) === 1)
            ||
            (x%3 === 1 && y%3 === 1)
        ),
        period: {
            x: 9,
            y: 9,
        },
    },
    carpet: {
        func: (x, y) => (
            (
                x === 7 || y === 7
                ?
                false
                :
                (
                    (Math.abs(x - 3) + Math.abs(y - 3)) < 3
                    ?
                    x%2 + y%2 === 1
                    :
                    x%2 + y%2 !== 1
                )
            )
        ),
        // in other words: the right and bottom edge should be blank,
        // the rest should be checkered, except for a diamond 5 pixels
        // wide in the center where the checker is inverted.
        period: {
            x: 8,
            y: 8,
        },
    },
    sand: {
        func: (x, y) => (x - Math.floor(y/4))%4 === 1 && (y - Math.floor(x/4))%4 === 1,
        period: {
            x: 8,
            y: 8,
        },
    },
    houndstooth: {
        func: (x, y) => (y < 4 && posmod(x - y - 1, 4) < 2) || (x < 4 && posmod(x - y - 1, 4) >= 2),
        period: {
            x: 8,
            y: 8,
        },
    },
    houndstoothX: {
        func: (x, y) => (y < 4 && posmod(x - y - 1, 4) < 2),
        period: {
            x: 8,
            y: 8,
        },
    },
    houndstoothY: {
        func: (x, y) => (x < 4 && posmod(x - y - 1, 4) >= 2),
        period: {
            x: 8,
            y: 8,
        },
    },
    diagonal: {
        func: (x, y) => posmod(x - y - 1, 4) < 2,
        period: {
            x: 4,
            y: 4,
        },
    },
    pinstripe: {
        func: (x, y) => x === y,
        period: {
            x: 3,
            y: 3,
        },
    },
    "2:1": {
        func: (x, y) => invertboolean(x === 2, y === 2),
        period: {
            x: 3,
            y: 3,
        },
    },
    "2:1:1:1": {
        func: (x, y) => invertboolean([2, 4].includes(x), [2, 4].includes(y)),
        period: {
            x: 5,
            y: 5,
        },
    },
    "2:1:3:1": {
        func: (x, y) => invertboolean([2, 6].includes(x), [2, 6].includes(y)),
        period: {
            x: 7,
            y: 7,
        },
    },
    "happy": {
        func: (x, y) => (
            x === 6
            ||
            y === 6
            ||
            (
                [1, 3].includes(x)
                &&
                [0, 1].includes(y)
            )
            ||
            (
                [0, 4].includes(x)
                &&
                y === 3
            )
            ||
            (
                1 <= x && x <= 3
                &&
                y === 4
            )
        ),
        period: {
            x: 8,
            y: 8,
        },
    },
    "mad": {
        func: (x, y) => (
            x === 6
            ||
            y === 6
            ||
            (
                [0, 4].includes(x)
                &&
                [0, 4].includes(y)
            )
            ||
            (
                [1, 3].includes(x)
                &&
                y === 1
            )
            ||
            (
                1 <= x && x <= 3
                &&
                y === 3
            )
        ),
        period: {
            x: 8,
            y: 8,
        },
    },
    "sad": {
        func: (x, y) => (
            x === 6
            ||
            y === 6
            ||
            (
                [1, 3].includes(x)
                &&
                y === 1
            )
            ||
            (
                [0, 4].includes(x)
                &&
                y === 2
            )
            ||
            (
                x === 2
                &&
                y === 4
            )
        ),
        period: {
            x: 8,
            y: 8,
        },
    },
    "-_-": {
        func: (x, y) => (
            x === 6
            ||
            y === 6
            ||
            (
                [0, 1, 3, 4].includes(x)
                &&
                y === 1
            )
            ||
            (
                1 <= x && x <= 3
                &&
                y === 4
            )
        ),
        period: {
            x: 8,
            y: 8,
        },
    },
    // might delete these, or at least hide them from the drawing app.
    // they're pretty stupid
};
//
function getattribute(element, property) {
// you have to go through a surprising amount of stupid shit to get html element
// properties.
    let temp = element.attributes.getNamedItem(property);
    return (temp === null || temp === undefined) ? temp : temp.value;
}
//
class Loop {
// class for figuring out where an infinite loop is happening.
// - location: string for where the loops are happening. generally, it's the
//   name of the function, since these are meant to be created for every
//   function. this is used when it logs that there's an infinite loop.
// - threshold: how many loops need to happen for it to be considered an
//   infinite loop and log an error.
// - levels: array. one index for each loop within a loop.
//   - name
//   - count
    constructor(location, threshold) {
        location ??= "unknown";
        threshold ??= 1000;
        this.location = location;
        this.threshold = threshold;
        this.levels = [];
    }
    tick(name, log) {
    // put this in the loop. it'll tick the level of this name up one. if
    // the name hasn't been used yet, it'll create a new level of that name.
    // - log: variable to log with the error.
        let index = this.levels.findLastIndex((level) => level.name === name);
        if(index === -1) {
        // start a new level
            index = this.levels.length;
            this.levels[index] = {name, count: 1};
        }
        else {
            this.levels[index].count++;
        };
        if(this.levels[index].count === this.threshold) {
            console.log("infinite loop at " + this.location);
            console.log(this);
            if(log !== undefined) {
                console.log(log);
            }
        }
        this.levels = this.levels.slice(0, index + 1);
    }
    end() {
        this.levels = this.levels.slice(0, -1);
    }
};
//
function readnumber(string) {
// allows fractions, returns null if it's NaN, Infinity, empty, etc
    if(!string || typeof string !== "string") {
        return null;
    }
    else if(string.includes("/")) {
        string = string.split("/");
        string = Number(string[0]/string[1]);
    }
    else {
        string = Number(string);
    };
    return (
        Number.isInteger(Math.round(string))
        ?
        string
        :
        null
    );
}
function readpoint(string) {
// a variant of readnumber that reads a list of numbers instead. (the values
// should be separated by commas, and there shouldn't be brackets or anything
// around it.)
    string = string.trim();
    string = string ? string.split(",") : [];
    for(let i1 = 0; i1 < string.length; i1++) {
        string[i1] = readnumber(string[i1]);
    }
    return string;
}
function gethtmlsetting(element, caveats) {
// simplifies some of the process of getting a html input and stuff like that.
    caveats ??= [];
    if(!Array.isArray(caveats)) {
        caveats = [caveats];
    }
    let type = element.tagName.toLowerCase();
    if(type === "input") {
        type = element.type;
    };
    let value = element[
        type === "checkbox" ? "checked" :
        type === "div" || type === "pre" ? "innerHTML" :
        "value"
    ];
    //
    if(type === "number") {
        value = !value.trim() ? NaN : Number(value);
        if(isNaN(value)) {
            value = null;
        }
        else if((value === Infinity || value === -Infinity) && !caveats.includes("infinity allowed")) {
            value = null;
        }
        else {
            if(caveats.includes("positive") || caveats.includes("over zero")) {
                value = Math.abs(value);
            };
            if(caveats.includes("integer")) {
                value = Math.trunc(value);
            };
            if(caveats.includes("over zero") && !value) {
                value = null;
            };
        };
    }
    else if(type === "textarea" && caveats.includes("strings")) {
        value = value.split("\n");
        for(let i1 = 0; i1 < value.length; i1++) {
            value[i1] = trimunspecial(value[i1]);
            if(!value[i1].trim()) {
                value.splice(i1, 1);
                i1--;
            }
        }
        if(!value.length && !caveats.includes("empties allowed")) {
            value = null;
        }
    }
    else if(type === "text" && caveats.includes("date")) {
        value = value.trim();
        value = datechecker(value) ? value : null;
    }
    else if(type === "text" && caveats.includes("symbols")) {
    // get rid of whitespace and duplicate characters
        let temp = "";
        for(let i1 = 0; i1 < value.length; i1++) {
            if(!temp.includes(value[i1]) && value[i1].trim()) {
                temp += value[i1];
            }
        }
        value = temp;
    }
    else if((type === "text" || type === "textarea") && caveats.includes("index list")) {
        value = trimunspecial(value)
        value = value ? value.split(" ") : [];
        for(let i1 = 0; i1 < value.length; i1++) {
            let num = Number(value[i1].endsWith(",") ? value[i1].slice(0, -1) : value[i1]);
            if(Number.isInteger(num) && num >= 0) {
                value[i1] = num;
            }
            else {
                value.splice(i1, 1);
                i1--;
            }
        }
    };
    //
    if(!caveats.includes("empties allowed")) {
        if(
            (Array.isArray(value) && !value.length)
            ||
            (typeof value === "string" && !value.trim())
        ) {
            value = null;
        };
    };
    //
    return value;
};

function objectdifference(obj1, obj2) {
    let i1 = 0;
    let list = [];
    for(i1 in obj1) {
        if(obj1.hasOwnProperty(i1) && !list.includes(i1)) {
            list[list.length] = i1;
        }
    }
    for(i1 in obj2) {
        if(obj2.hasOwnProperty(i1) && !list.includes(i1)) {
            list[list.length] = i1;
        }
    }
    let obj = {};
    for(let _i1 = 0; _i1 < list.length; _i1++) {
        i1 = list[_i1];
        if(i1 in obj1 && i1 in obj2) {
            if(typeof obj1[i1] !== typeof obj2[i1]) {
                obj[i1] = structuredClone(obj2[i1]);
            }
            else if(!compareobject(obj1[i1], obj2[i1])) {
                if(typeof obj1[i1] === "object") {
                    obj[i1] = objectdifference(obj1[i1], obj2[i1]);
                }
                else {
                    obj[i1] = structuredClone(obj2[i1]);
                }
            }
        }
        else if(i1 in obj1) {
            obj[i1] = undefined;
        }
        else if(i1 in obj2) {
            obj[i1] = structuredClone(obj2[i1]);
        }
    }
    return obj;
}
//
function randexponent(factor, allownegative) {
// multiplies multiple Math.random()s to create a value that's more likely
// to be near zero.
// - allownegative: boolean. if true, the random numbers will be between -1
//   and 1 instead of 0 and 1.
    let returnvalue = 1;
    for(let i1 = 0; i1 < factor; i1++) {
        returnvalue *= (allownegative && Math.random() < .5 ? -1 : 1)*Math.random();
        //returnvalue *= (allownegative ? Math.random()*2 - 1 : Math.random());
    }
    let float = factor%1;
    if(float) {
        returnvalue *= (allownegative && Math.random() < .5 ? -1 : 1)*(float*Math.random() + (1 - float));
    };
    return returnvalue;
}


function arraytoul(array, indent, charcode) {
// technically this is a string thing, but i use it too often. lets me avoid
// loading the whole strings script.
// - input an array that has nothing but strings or arrays that, themselves,
//   have nothing but strings or arrays.
// - you can also use integers to replace the bullet marker with a unicode
//   character.
//   - if you put 9734 before a string, that bullet will use a star.
//   - if you put 9734 before an array, that array's bullets will use stars.
//   - if you put 9734 in the charcode argument, all bullets will use stars.
//   - nesting and all that is taken into account.
    let i1 = 0;
    indent ??= 0;
    charcode = Number.isInteger(charcode) ? charcode : null;
    let _charcode = charcode;
    let html = ``;
    html += `<ul>`;
    for(i1 = 0; i1 < array.length; i1++) {
        if(Number.isInteger(array[i1])) {
            _charcode = array[i1];
        }
        else {
            let style = _charcode === null ? `` : ` style='list-style-type: "` + String.fromCharCode(_charcode) + `"'`;
            html += (
                typeof array[i1] === "string" ? `\n\t<li` + style + `>\n\t\t` + array[i1].replaceAll(`\t`, ``).replaceAll(`\n`, ` `) + `\n\t</li>` :
                Array.isArray(array[i1]) ? `\n\t` + arraytoul(array[i1], indent, _charcode).replaceAll(`\n`, `\n\t`) :
                ``
            );
            _charcode = charcode;
        }
    }
    html += `\n</ul>`;
    return html;
};
function manualhtml(obj, title) {
// used to make a manual that's an object of arraytouls, with each property
// being a <details>.
    let html = [];
    for(let i1 in obj) {
        if(obj.hasOwnProperty(i1)) {
            if(Array.isArray(obj[i1])) {
                html.push([
                    "<details>",
                    "<summary>" + i1 + "</summary>",
                    arraytoul(obj[i1], 1),
                    "</details>"
                ].join("\n"));
            }
            else {
                console.log("this shouldn't happen");
            };
        }
    }
    html = [
        "<details class=\"text\">",
        "<summary>" + title + "</summary>",
        "<ul>",
        "\t" + html.join("\n").replaceAll("\n", "\n\t"),
        "</ul>",
        "</details>"
    ].join("\n");
    return html;
};

class States extends Array {
// a class for adding undo/redo functionality to a tool.
// - integer properties: states. lower numbers are newer, higher numbers are
//   older.
// - index: which state is currently loaded.
// - limit: how long the array can get before it starts deleting the oldest
//   states.
// - tool: the big object this is part of and used on.
// - savefunc: a (tool) function for creating a state.
// - loadfunc: (tool, state) function for applying a state.
// =
// - checklist:
//   - fill all arguments of the constructor properly.
//   - add a tool.refresh() call in your loadfunc, so changes are shown
//     - but don't save a new state during that refresh!
//   - DON'T save a new state during tool.initialize(); the constructor saves a
//     new state automatically
//     - call the constructor after the data being saved is fully formed. don't
//       just put it in the tool's defining.
//   - call .save() during tool.refresh(), so that new states are made
//   - but add an argument for skipping that, so you can use that argument in
//     loadfunc
//     - use this argument in any refresh that's purely visual, like mouse tools
//       where you drag stuff around. refreshes can visualize the movement
//       before the click is done, but a state should only be saved when the
//       edit is finalized.
//   - add buttons and key events for it.
    // fpt.states = new States(fpt, 32, (tool) => structuredClone(tool.markers), function(tool, state) { tool.markers = structuredClone(state) });
    constructor(tool, limit, savefunc, loadfunc) {
        super();
        this.tool = tool;
        this.limit = Number.isInteger(limit) && limit > 0 ? limit : 32;
        this.savefunc = typeof savefunc === "function" ? savefunc : function(tool) {};
        this.loadfunc = typeof loadfunc === "function" ? loadfunc : function(tool, state) {};
        this[this.length] = this.savefunc(this.tool);
        this.index = 0;
    }
    save() {
        if(this.index > 0) {
        // clear redo
            this.splice(0, this.index);
            this.index = 0;
        };
        this.splice(0, 0, this.savefunc(this.tool));
        if(this.length > this.limit) {
        // keep it within limit
            this.splice(this.limit, this.length - this.limit);
        };
    }
    load(index) {
    // using in undo/redo, and the anim_index setter. applies the changes
    // stored in a state.
        this.loadfunc(this.tool, this[this.index]);
    }
    undo() {
        if(this.index + 1 < this.length) {
            this.index++;
            this.load(this.index);
        };
    }
    redo() {
        if(this.index > 0) {
            this.index--;
            this.load(this.index);
        };
    }
    get current() {
        return this[this.index];
    }
};

function textarea_tab(e) {
// set a textarea's onkeydown to this, and you'll avoid that problem where
// pressing tab exits the textarea and goes to the next button or whatever.
    if(e.key.toLowerCase() === "tab") {
        e.preventDefault();
        let _this = e.target;
        let start = _this.selectionStart;
        _this.value = _this.value.slice(0, start) + "\t" + _this.value.slice(_this.selectionEnd);
        _this.selectionStart = start + 1;
        _this.selectionEnd = start + 1;
    }
}
function textarea_autosize(textarea) {
// used to automatically resize a textarea to fit the text content.
// - you can use it with the textarea as an argument, or you can set the
//   textarea's onkeydown to it.
    if(textarea instanceof Event) {
        textarea = textarea.target;
    };
    //let start = this.selectionStart;
    //let end = this.selectionEnd;
    textarea.rows = word_wrap(textarea.value, textarea.cols).split("\n").length + 1;
    //this.selectionStart = start;
    //this.selectionEnd = end;
}

function filedate() {
// returns a date string, to use in file names.
    let temp = new Date();
    temp = [temp.getFullYear().toString(), (temp.getMonth() + 1).toString(), temp.getDate().toString()];
    for(let i1 = 1; i1 < temp.length; i1++) {
        temp[i1] = "0".repeat(2 - temp[i1].length) + temp[i1];
    }
    return temp.join("_");
};
function filename_handler(name) {
// returns a filename with the extension and parenthesed numbers removed.
// - tools like PixelArt and armature artist, when it loads a file, it saves the
//   name, to later use it when the file is saved.
// - but, you know. you're downloading, not overwriting. if your file is named
//   "project.txt", after you load, edit, and save it again, it'll be
//   "project(1).txt"... and after you load, edit, and save it again, it'll be
//   "project(1)(1).txt"... see the problem?
// - if you use this, instead, it'll be "project(2).txt". which isn't ideal
//   either but hey! fuck off.
    let index = name.lastIndexOf(".");
    name = index === -1 ? name : name.slice(0, index);
    // slice off the file extension
    index = name.lastIndexOf("(");
    if(name.endsWith(")") && index !== -1) {
        let num = Number(name.slice(index + 1, -1));
        if(Number.isInteger(num) && num > 0) {
            name = name.slice(0, index).trimEnd();
        };
        // slice off the number
    }
    return name;
};

//

function numalign(values, skiprightspaces) {
// adds spaces to the beginning and/or end of each number so they all line
// up.
// - values should be an array of numbers.
// =
// moved to reusables
    let i1 = 0;
    function numofdigits(value) {
    // returns an array with the number of digits before and after the decimal
    // point.
    // =
    // moved to reusables
        value = "" + value;
        if(value.includes(".")) {
            return [value.indexOf("."), value.length - (value.indexOf(".") + 1)];
        }
        else {
            return [value.length, 0];
        };
    }
    let maxleftdigits = null;
    let maxrightdigits = null;
    for (i1 = 0; i1 < values.length; i1++) {
        if(maxleftdigits === null || numofdigits(values[i1])[0] > maxleftdigits) {
            maxleftdigits = numofdigits(values[i1])[0];
        };
        if(maxrightdigits === null || numofdigits(values[i1])[1] > maxrightdigits) {
            maxrightdigits = numofdigits(values[i1])[1];
        };
    }
    for (i1 = 0; i1 < values.length; i1++) {
        if(numofdigits(values[i1])[0] < maxleftdigits) {
            values[i1] = " ".repeat(maxleftdigits - numofdigits(values[i1])[0]) + values[i1];
        }
        else {
            values[i1] = "" + values[i1];
        };
        if(!skiprightspaces && numofdigits(values[i1])[1] < maxrightdigits) {
            values[i1] = values[i1] + " ".repeat(maxrightdigits - numofdigits(values[i1])[1]);
        };
    }
    return values;
}
function converttime(input, fromnumbers, amount, shush) {
// only accepts XX:XX[a/p] format. this is not how javascript writes
// dates, it's how i write dates.
// - fromnumbers: if this is true, it'll use the input as a number
//   and convert to the time string instead.
// - amount: if this is true, it'll assume you're converting not a
//   time, but an amount of hours, minutes, and seconds.
//   - it accepts XhXXmXXs, XhXXm, XmXXs, Xh, Xm, and Xs.
//   - NOTE: it returns the seconds, not minutes! also, if you're
//     converting *to* a time amount, it will always write the seconds.
// - gotta make sure to test this... i always screw up with
//   functions like this, somehow.
//   - takes way longer than you'd think, too.
// - NOTE: it gets rid of "~" at the beginning, and it can process +/-
//   at the beginning
// =
// moved to reusables
    let i1 = 0;
    let i2 = 0;
    if(!fromnumbers && input.startsWith("~")) {
        input = input.slice(1);
    };
    if(amount) {
        if(fromnumbers) {
            let negative = input < 0;
            input = Math.floor(Math.abs(input));
            let seconds = input;
            let minutes = Math.floor(seconds/60);
            seconds -= minutes*60;
            let hours = Math.floor(minutes/60);
            minutes -= hours*60;
            seconds += "";
            minutes += "";
            hours += "";
            minutes = "0".repeat(2 - minutes.length) + minutes;
            seconds = "0".repeat(2 - seconds.length) + seconds;
            let output = hours + "h" + minutes + "m" + seconds + "s";
            // example: 0h03m56s
            if(hours === "0") {
                output = output.slice(2);
                if(minutes === "00") {
                    output = output.slice(3);
                    if(seconds === "00") {
                        output = output.slice(1);
                    }
                    else if(seconds.slice(0, 1) === "0") {
                        output = output.slice(1);
                    };
                }
                else if(minutes.slice(0, 1) === "0") {
                    output = output.slice(1);
                };
            };
            return (negative ? "-" : "") + output;
        }
        else {
            let negative = false;
            if(input[0] === "+") {
                input = input.slice(1);
            }
            else if(input[0] === "-") {
                input = input.slice(1);
                negative = true;
            };
            let nums = {};
            let slicestart = 0;
            for (i1 = 0; i1 < input.length; i1++) {
                if("hms".includes(input[i1])) {
                    nums[input[i1]] = Number(input.slice(slicestart, i1));
                    if(slicestart !== 0 && i1 - slicestart !== 2) {
                    // only the largest type is allowed to have as many
                    // digits as it wants. (ex: 1h7m is invalid, 1m100s
                    // is invalid)
                        if(!shush) {
                            console.log("invalid input.");
                        }
                        return;
                    }
                    slicestart = i1 + 1;
                }
                else if(i1 === input.length - 1) {
                // it should end with one of those.
                    if(!shush) {
                        console.log("invalid input.");
                    }
                    return;
                }
                else if(!"0123456789".includes(input[i1])) {
                // it should only be numbers and h/m/s.
                    if(!shush) {
                        console.log("invalid input.");
                    }
                    return;
                }
            }
            nums.h ??= 0;
            nums.m ??= 0;
            nums.s ??= 0;
            return (negative ? -1 : 1)*(nums.h*60*60 + nums.m*60 + nums.s);
        };
    }
    else {
        if(fromnumbers) {
            input %= 24*60;
            let ampm = "";
            if(input >= 12*60) {
                input -= 12*60;
                ampm += "p";
            };
            let hours = Math.floor(input/60).toString();
            let minutes = (input%60).toString();
            if(hours === "0") {
                hours = "12";
            };
            hours = "0".repeat(2 - hours.length) + hours;
            return hours + ":" + minutes + ampm;
        }
        else {
            let hours = Number( input.slice(0, input.indexOf(":")) );
            let minutes = Number( input.slice(input.indexOf(":") + 1, -1) );
            if(
            !input.includes(":")
            ||
            (input.slice(-1) !== "a" && input.slice(-1) !== "p")
            ||
            !hours || !Number.isInteger(hours) || hours < 1 || hours > 12
            ||
            !input.slice(input.indexOf(":") + 1, -1) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 60
            ) {
                // hours shouldn't be zero, though that's valid in some
                // systems (also empty space can be number-converted to
                // 0 and i don't feel like dealing with it. except i
                // already did for minutes.)
                if(!shush) {
                    console.log("invalid converttime input.");
                };
                return;
            };
            if(hours === 12) {
                hours = 0;
            };
            return hours * 60 + minutes + (input.slice(-1) === "p" ? 12*60 : 0);
        };
    };
}
function get2dline(x1, y1, x2, y2) {
// standard form. Ax + By + C = 0. this is A, B, and C.
    //(y1 - y2)x + (x2 - x1)y + (x1*y2 - x2*y1) = 0
    let line = get2dangle(x2 - x1, y2 - y1);
    line = [
        Math.cos(line + Math.PI/2),
        Math.sin(line + Math.PI/2)
    ];
    line[2] = -(x1*line[0] + y1*line[1]);
    return line;
}
function fourpointintersect(x1, y1, x2, y2, x3, y3, x4, y4, shush, segmentsintersect) {
// finds the intersection between a line that crosses point 1 and point
// 2 and a line that cross point 3 and point 4, returning it as an array
// - shush: returns a string of what went wrong instead of logging an error
// - segmentsintersect: makes it add another item to the array, a boolean
//   for whether the intersection is within the line segments specified.
    let i1 = 0;
    if((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        if(shush) {
            return "point";
        }
        else {
            console.log("invalid input. one or both lines begin and end at the same point.");
            return;
        };
    }
    let lineA = get2dline(x1, y1, x2, y2, true);
    let lineB = get2dline(x3, y3, x4, y4, true);
    //let temp = new Line(x1, y1, 0, [posmod(get2dangle(lineA[0], lineA[1]) + Math.PI/2, 2*Math.PI), 0]).planeintersect(new Plane(lineB[0], lineB[1], 0, lineB[2])).slice(0, 2);
    //console.log(temp);
    //return temp;
    let x = null;
    let y = null;
    if(lineA[0]/lineA[1] === lineB[0]/lineB[1]) {
    // same slope
        if(lineA[2] === lineB[2]) {
        // average all points
            x = ((x1 + x2)/2 + (x3 + x4)/2)/2;
            y = ((y1 + y2)/2 + (y3 + y4)/2)/2;
            return [x, y];
        }
        else {
            if(shush) {
                return "parallel";
            }
            else {
                console.log("lines are parallel.");
                return;
            };
        };
    };
    y = (lineA[0]*lineB[2] - lineB[0]*lineA[2])/(lineB[0]*lineA[1] - lineA[0]*lineB[1]);
    x = [
        -(lineA[1]*y + lineA[2])/lineA[0],
        -(lineB[1]*y + lineB[2])/lineB[0]
    ];
    if(!shush && Math.abs(x[0] - x[1]) > .0000000001) {
        console.log(x);
    }
    x = x[0];
    if(segmentsintersect) {
        let temp = (
            Math.min(x1, x2) <= x && x <= Math.max(x1, x2)
            &&
            Math.min(y1, y2) <= y && y <= Math.max(y1, y2)
            &&
            Math.min(x3, x4) <= x && x <= Math.max(x3, x4)
            &&
            Math.min(y3, y4) <= y && y <= Math.max(y3, y4)
        );
        return [x, y, temp];
    }
    else {
        return [x, y];
    };
}
//function finddistance(x1, y1, x2, y2) {
//	return Math.sqrt((x2-x1)**2 + (y2-y1)**2);
//}
// just use Math.hypot((x2 - x1), (y2 - y1))
function mathgcf(numbers, shush) {
// numbers: an array.
    let i1 = 0;
    let i2 = 0;
    let i3 = 0;
    if(numbers.includes(0)) {
        return 0;
    }
    _numbers = [];
    for (i1 = 0; i1 < numbers.length; i1++) {
        if(typeof numbers[i1] !== "number" || !Number.isInteger(numbers[i1])) {
            if(!shush) {
                console.log("invalid input, they must all be integers");
                console.log(numbers[i1]);
            };
            return;
        };
        _numbers[i1] = Math.abs(numbers[i1]);
    }
    let lowest = Math.min(..._numbers);
    let temp = false;
    //*
    let denom = 0;
    for (i1 = 1; i1 <= lowest/2; i1++) {
        denom = lowest/i1;
        if(Number.isInteger(denom)) {
            temp = true;
            for (i2 = 0; i2 < _numbers.length; i2++) {
                temp = _numbers[i2]%denom === 0;
                if(!temp) {
                    i2 += _numbers.length;
                };
            }
            if(temp) {
                return denom;
            };
        }
    }
    return 1;
    //*/
    /*
    for (i1 = lowest; i1 >= 1; i1--) {
        temp = true;
        for (i2 = 0; i2 < _numbers.length; i2++) {
            temp = _numbers[i2]%i1 === 0;
            if(!temp) {
                i2 += _numbers.length;
            };
        }
        if(temp) {
            return i1;
        };
    }
    //*/
};
function mathlcd(numbers, shush) {
    let gcf = mathgcf(numbers, shush);
    let lcd = gcf;
    let i1 = 0;
    for (i1 = 0; i1 < numbers.length; i1++) {
        lcd *= numbers[i1]/gcf;
    };
    return Math.abs(lcd);
};
function mathtester(func, condition, sortby, iterations, func_arg, graph) {
// used to test math functions.
/*
document.getElementById("mt_area").hidden = false;
mathtester(function() {
    //
},
false, false, false, false, {
    ctx: document.getElementById("mt_canvas").getContext("2d"),
    func: function(ctx, x, result) {
        ctx.fillRect(x, ctx.canvas.height, 1, -ctx.canvas.height*result.???/???);
        ctx.fillRect(x, ctx.canvas.height*(1 - result.error/???), 1, 1);
    }
    log: false,
});
//*/
// - func: this should be a function that creates and returns an
//   object created through randomness and the math functions you're
//   testing.
//   - for example, if i wanted to test a function that revolves
//     points, i'd plot a random point, use a math function that
//     *should* bring a control (or maybe another random point) to
//     that position, then use Math.hypot to calculate how close it
//     is. it'd return something like:
//     - .destination (coordinate array)
//     - .accuracy (Math.hypot result)
// - condition: boolean function for putting something in the
//   success array instead of the failure array. (func's output will
//   be used as the sole parameter.) by default it is (result) =>
//   result[sortby] < .0000000001.
// - sortby: a string for the property they're going to be sorted
//   by. by default, it is "error".
// - iterations: number of trials. 1000 by default
// - func_arg: specify arguments for func, in the form of an array.
// - graph: an object for graphing
//   - .ctx
//   - .func: function for graphing
//     - arguments
//       - ctx
//       - x: the row to use for your fillRects and what not
//       - result: the object that holds all the data for this
//         success/failure
//     - fillStyle and strokeStyle will be start as green or orange
//       depending on whether it was success or failure.
//   - log: boolean for whether to bother logging the success/failure arrays
    let i1 = 0;
    let success = [];
    let failure = [];
    condition	= typeof condition	=== "function"	? condition		: (result) => result[sortby] < .0000000001;
    sortby		= typeof sortby		=== "string"	? sortby		: "error";
    iterations	= typeof iterations	=== "number"	? iterations	: 1000;
    let total_failure = null;
    for(i1 = 0; i1 < iterations; i1++) {
        let result = (Array.isArray(func_arg) ? func(...func_arg) : func());
        if(condition(result)) {
            success[success.length] = structuredClone(result);
        }
        else {
            failure[failure.length] = structuredClone(result);
            if(result.hasOwnProperty("error")) {
                total_failure += result.error;
            };
        }
    }
    function mt_sort(a, b) {
        return a[sortby] - b[sortby];
    };
    success.sort(mt_sort);
    failure.sort(mt_sort);
    if(!graph || graph.hasOwnProperty("log") && graph.log) {
        console.log("success:");
        console.log(success);
        console.log("failure:" + (total_failure === null ? "" : " (average: " + total_failure/failure.length + ")"));
        console.log(failure);
    };
    if(graph) {
        let ctx = graph.ctx;
        ctx.canvas.width = success.length + failure.length;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for (i1 = 0; i1 < success.length; i1++) {
            ctx.fillStyle = "green";
            ctx.strokeStyle = "green";
            graph.func(ctx, i1, success[i1]);
        }
        for (i1 = 0; i1 < failure.length; i1++) {
            ctx.fillStyle = "orange";
            ctx.strokeStyle = "orange";
            graph.func(ctx, success.length + i1, failure[i1]);
        }
    }
}
function logspecial(variables, preface, stringify) {
// lets you log several variables at once in a very concise and clear way.
// - variables: an object. just take a bunch of variables separated by
//   commas, and add curly braces.
// - preface: if present, it will log this string first. useful for letting
//   you know where it is in the code.
// - stringify: if true, objects will be logged as text instead of being
//   logged separately.
//   - if stringify === "get", it'll return the text instead of logging it.
//     (this is useful for ProcAnims. drawing text on the canvas that says
//     the state of a variable.)
    let i1 = 0;
    if(preface) {
        console.log(preface);
    };
    let text = "";
    let maxlength = 0;
    for (i1 in variables) {
        if (variables.hasOwnProperty(i1) && i1.length > maxlength) {
            maxlength = i1.length;
        }
    }
    for (i1 in variables) {
        if (variables.hasOwnProperty(i1) && (typeof variables[i1] !== "object" || stringify)) {
            text += (text ? String.fromCharCode(10) : "") + i1 + " ".repeat(maxlength - i1.length) + ": ";
            if(typeof variables[i1] === "object" && !Array.isArray(variables[i1])) {
                text += JSON.stringify(variables[i1]);
            }
            else {
                text += variables[i1];
            }
        }
    }
    if(text) {
        if(stringify === "get") {
            return text;
        }
        else {
            console.log(text);
        };
    };
    if(!stringify) {
        for (i1 in variables) {
            if (variables.hasOwnProperty(i1) && typeof variables[i1] === "object" && variables[i1]) {
                console.log(i1 + " ".repeat(maxlength - i1.length) + ": ");
                console.log(variables[i1]);
            }
        }
    }
}

var userfocus = "";
// a string for which tool the user last clicked. used to prevent key events
// from triggering for tools the user isn't using.
// - this uses var for a reason. for the sake of classes that use it, it
//   needs to be retrievable.
function changefocus(focus) {
// 99% of the time all this does is change the userfocus variable. the only
// reason it's a function at all is so that it can be overridden by similar
// functions that actually react to changes.
// - that was a bad explanation, wasn't it.
// - this is basically like a setter. sometimes tools run processing functions a
//   few times a second, right? it'd be pretty goddamn uncool for those to keep
//   running even when you're not using a different tool.
// - so when i need something like that, i write a new changefocus specifically
//   for that page. that way i can do setter stuff in there. but that requires a
//   norm of using a function in the first place, instead of just redefining it
//   normally.
    userfocus = focus;
};
function clickxy(e, focusname) {
    if(typeof focusname === "string" && typeof userfocus !== "undefined") {
        changefocus(focusname);
    };
    return [
        Math.floor(e.clientX - e.target.getBoundingClientRect().left),
        Math.floor(e.clientY - e.target.getBoundingClientRect().top)
    ];
};
function keyinterpreter(key) {
    if(key.length === 1) {
        key = key.toLowerCase();
        // so that w and W don't have to be mapped separately.
        let temp = ")!@#$%^&*(";
        if(temp.includes(key)) {
            key = temp.indexOf(key).toString();
        };
        // same with the symbols mapped to number keys
    };
    return key;
};
let screen_w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
let screen_h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
let verticalscreen = screen_h > screen_w;
function htmldescendants(element) {
    let desc = [];
    let list = element.children;
    for(let i1 = 0; i1 < list.length; i1++) {
        desc.push(list[i1]);
        desc = desc.concat(htmldescendants(list[i1]));
    }
    return desc;
};
function htmlrefobj(container) {
// returns an object of html references.
    let refobj = {};
    let desc = htmldescendants(container);
    for(let i1 = 0; i1 < desc.length; i1++) {
        let ref = desc[i1];
        let name = (
            ref.name ? ref.name :
            "name" in ref.attributes ? ref.attributes.name.value :
            ref.tagName.toLowerCase() === "button" ? ref.innerHTML :
            ""
        );
        if(name) {
            refobj[name] = ref;
        };
    }
    return refobj;
};










// circledraw
// fourpointintersect
// -
// isobject
// compareobject

// diamondsquare
// voronoi
// protodelaunay
