const Frac = {
// a pseudoclass for improper fractions, stored as an array of a numerator and
// denominator. i use it for music programming.
    new: function(whole, numer, denom) {
        whole = whole && typeof numer === "number" ? whole : 0;
        numer = numer && typeof numer === "number" ? numer : 0;
        denom = denom && typeof denom === "number" ? denom : 1;
        return [
            whole*denom + numer,
            denom
        ];
    },
    sync: function(fracs) {
    // returns the array of fracs with all of them multiplied so that all their
    // denominators are the same.
        let lcd = [];
        let i1 = 0;
        for (i1 = 0; i1 < fracs.length; i1++) {
            lcd[i1] = fracs[i1][1];
        }
        lcd = mathlcd(lcd, true);
        let _fracs = [];
        for (i1 = 0; i1 < fracs.length; i1++) {
            _fracs[i1] = [
                lcd*fracs[i1][0]/fracs[i1][1],
                lcd
            ];
        }
        return _fracs;
    },
    math: function(_this, operation, modifier) {
    // operation should be a string of an operator.
        if(
            Array.isArray(_this) && Array.isArray(modifier)
            &&
            (_this.length > 2 || modifier.length > 2)
        ) {
        // if there's 4 numbers, it assumes it's 2d coordinates. if there's 6,
        // 3d, etc.
            if(_this.length === modifier.length && !(_this.length%2)) {
                let _return = [];
                for(let i1 = 0; i1 < _this.length; i1 += 2) {
                    _return = _return.concat( Frac.math(_this.slice(i1, i1 + 2), operation, modifier.slice(i1, i1 + 2)) );
                }
                return _return;
            }
            else {
                console.log("invalid input.");
                return;
            };
        };
        //
        if(typeof modifier === "number") {
            modifier = [modifier, 1];
            // the math logic is designed for fractions
        };
        if(operation === "-") {
            modifier[0] *= -1;
            operation = "+";
        }
        else if(operation === "/") {
            modifier = [modifier[1], modifier[0]];
            operation = "*";
        };
        let temp = [null, null];
        if(_this[1] !== modifier[1] && operation !== "*") {
        // make the denominators match
            if(modifier[1] === 1) {
            // this will be faster than Frac.sync and mathlcd
                temp = [
                    structuredClone(_this),
                    structuredClone(modifier),
                ]
                temp[1][0] *= _this[1];
                temp[1][1] *= _this[1];
            }
            else {
                temp = Frac.sync([_this, modifier]);
            }
        }
        else {
            temp = [_this, modifier];
        }
        let _return = null;
        if(operation === "+") {
            _return = [
                temp[0][ 0 ] + temp[1][ 0 ],
                temp[0][ 1 ]
            ];
        }
        else if(operation === "*") {
            _return = [
                temp[0][ 0 ] * temp[1][ 0 ],
                temp[0][ 1 ] * temp[1][ 1 ]
            ];
        }
        else if(operation === "%") {
            _return = [
                temp[0][ 0 ] % temp[1][ 0 ],
                temp[0][ 1 ]
            ];
        }
        else if(operation === "pos%") {
            _return = [
                posmod(temp[0][ 0 ], temp[1][ 0 ]),
                temp[0][ 1 ]
            ];
        }
        else {
            console.log("invalid operand: " + operation);
        };
        return Frac.simplify(_return);
    },
    add:			(_this, addend)		=> Frac.math(_this, "+", addend),
    subtract:		(_this, subtrahend)	=> Frac.math(_this, "-", subtrahend),
    multiply:		(_this, multiplier)	=> Frac.math(_this, "*", multiplier),
    divide:			(_this, divisor)	=> Frac.math(_this, "/", divisor),
    mod:            (_this, divisor)	=> Frac.math(_this, "%", divisor),
    posmod:     	(_this, divisor)	=> Frac.math(_this, "pos%", divisor),
    num:			(_this)				=> _this[0]/_this[1],
    simplify: function(_this) {
        if(_this[0] === 0) {
            return [0, 1];
        }
        else if(!Number.isInteger(_this[0])) {
            console.log(_this[0] + " is not an integer.");
            return;
        };
        if(!Number.isInteger(_this[1])) {
            console.log(_this[1] + " is not an integer.");
            return;
        };
        let gcf = mathgcf(_this);
        return [
            _this[0]/gcf,
            _this[1]/gcf
        ];
    },
    int: function(_this, mode, factor) {
    // stores all the functions that turn decimals into integers. equivalents of
    // them, anyway. but the catch is that you can specify your own factor
    // instead of 1, ie round to the nearest 5/4 or something. useful in the
    // music stuff i made Frac for.
        mode = ["floor", "ceil", "round", "trunc"].includes(mode) ? mode : "floor";
        factor ??= 1;
        if(factor === 1) {
            return [Math[mode]( Frac.num(_this) ) * _this[1], _this[1]];
        };
        if(typeof factor === "number") {
            factor = [factor, 1];
        };
        let num = Frac.num( Frac.divide(_this, factor) );
        // number of factors inside _this
        if(Number.isInteger(num)) {
            return structuredClone(_this);
        }
        let trunc = Frac.multiply(factor, Math.trunc(num));
        if(mode === "round") {
            if(num%1 < .5) {
                mode = "floor";
            }
            else {
                mode = "ceil";
            };
        };
        return {
            trunc,
            floor: (num < 0 ? Frac.subtract(trunc, factor) : trunc),
            ceil: (num > 0 ? Frac.add(trunc, factor) : trunc),
        }[mode];
    },
    floor: (_this, factor) => Frac.int(_this, "floor", factor),
    ceil: (_this, factor) => Frac.int(_this, "ceil", factor),
    round: (_this, factor) => Frac.int(_this, "round", factor),
    trunc: (_this, factor) => Frac.int(_this, "trunc", factor),
    fromnum: function(number, range) {
    // enter a number and it'll try to find a fraction that matches it. it'll
    // return null if it fails.
    // - range: the number of possible denominators to search.
        range = typeof range === "number" ? range : 1000;
        for (let i1 = 1; i1 < range; i1++) {
            let temp = number*i1;
            if(Math.abs(temp - Math.trunc(temp)) < .0000000001) {
                return [Math.trunc(temp), i1];
            };
        }
        return null;
    },
    isfrac: (input) => Array.isArray(input) && input.length === 2 && typeof input[0] === "number" && typeof input[1] === "number",
    sort: function(fracs) {
        fracs.sort((a, b) => Frac.num(a) - Frac.num(b));
    },
};
