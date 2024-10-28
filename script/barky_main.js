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
let invertboolean = (original, condition) => (condition ? !original : original);
// i could do this by evaluating the boolean and using an if else but you
// know what? that shit isn't elegant at all.
// - by "condition" i mean the condition for the inversion. it should be
//   another boolean.
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
function objarraylength(object) {
// returns a number equivalent to the .length of an array. one more than the
// highest integer property.
    let i1 = "";
    let highest = null;
    for (i1 in object) {
        if (
            object.hasOwnProperty(i1) && Number.isInteger(Number(i1)) && (i1 || i1 === 0)
            &&
            (highest === null || Number(i1) > highest)
        ) {
            highest = Number(i1);
        };
    }
    if(highest === null) {
        return 0;
    }
    else {
        return highest + 1;
    };
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
    "noise 1.5625%": {
        func: (x, y) => Math.random() < .015625,
        erases: true,
    },
    "noise 25%": {
        func: (x, y) => Math.random() < .25,
        erases: true,
    },
    "noise 50%": {
        func: (x, y) => Math.random() < .5,
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


function arraytoul(array, indent) {
// technically this is a string thing, but i use it too often. lets me avoid
// loading the whole strings script.
    let i1 = 0;
    indent ??= 0;
    let html = ``;
    html += `<ul>`;
    for(i1 = 0; i1 < array.length; i1++) {
        html += (
            typeof array[i1] === "string" ? `\n\t<li>\n\t\t` + array[i1].replaceAll(`\t`, ``).replaceAll(`\n`, ` `) + `\n\t</li>` :
            Array.isArray(array[i1]) ? `\n\t` + arraytoul(array[i1], indent).replaceAll(`\n`, `\n\t`) :
            ``
        );
    }
    html += `\n</ul>`;
    return html;
}

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
//   - DON'T save a new state during tool.initialize(); the constructor saves a
//     new state automatically
//   - call .save() during tool.refresh(), so that new states are made
//   - but add an argument for skipping that, so you can use that argument in
//     loadfunc
//     - use this argument in any refresh that's purely visual, like mouse tools
//       where you drag stuff around. refreshes can visualize the movement
//       before the click is done, but a state should only be saved when the
//       edit is finalized.
//   - add key events for it.
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
};


// circledraw
// fourpointintersect
// -
// isobject
// compareobject
// limitlessrand
// objarraylength
// numofdigits
// numalign
// converttime

// converttime

// diamondsquare
// voronoi
// protodelaunay
// paintbucket
// converttime
// getcolor
