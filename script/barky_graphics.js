let _2dPoly = {
// a pseudoclass like Angle. a _2dPoly is an array of 2d coordinates that
// are connected to create a closed shape.
// - NOT to be confused with Shape2d. this is much more limited,
//   lightweight. points can only be connected by a straight line.
// - NOTE this does not work with shapes where the average of all points is
//   outside the shape, or hourglass-like shapes where lines cross each
//   other.
//   - the first one is only possible for extreme concave shapes, but still.
// - i mostly use it for things like drawing the triangles Polys are made
//   of.
// - TODO
//   - fix the concave issue
//     - using delaunay
//     - or using logic, maybe... if i can figure out which lines a point
//       should match and which ones it shouldn't...
//   - invert mode?
//   - the lines don't match up with nonaaline.
//   - optimizing
//     - sort the lines (and points. or just keep around line[i1].index?) by
//       how many pixels they should apply to
//       - since .within quits on a point as soon as it fails one equation.
    getdata: function(_this, include_edge, sl_center) {
    // creates an object with data for all the 2d lines, because otherwise
    // things like .draw and .execute would be calculating that every pixel.
    // - sl_center: center to use for the SL.news
    // =
    // - rect: the x, y, w, and h of the rectangle that all points in this
    //   _2dPoly should be within.
    // - within: the most important property, an array of booleans for each
    //   pixel in the rectangle, showing whether that point is within the
    //   shape. _2dPoly.execute works by iterating through all of these.
    // - center: the average of the remaining points, which was used to
    //   calculate .within.
    // - delete: indexes of points that were spliced out, because it'd be
    //   invalid otherwise. (like if two consecutive points are on the same
    //   spot.)
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let points = structuredClone(_this);
        // so that i can splice without modifying the original
        sl_center ??= _2dPoly.center(_this);
        // this center should be used for the SL.new, so that it's
        // consistent with where linespecial will place points. (the center
        // it uses will be based on a version that has the points rounded
        // and problematic points spliced out.)
        let deletepile = [];
        let next = (index) => posmod(i1 + 1, points.length);
        let prev = (index) => posmod(i1 - 1, points.length);
        let SER = [];
        for(i1 = 0; i1 < points.length; i1++) {
            SER[i1] = SL.start_end_rounding(...points[i1], ...points[next(i1 + 1)], sl_center).slice(0, 2);
        }
        for(i1 = 0; i1 < points.length; i1++) {
        // if it would create a zero-dimensions line, splice it
            if(SER[i1][0] === SER[next(i1)][0] && SER[i1][1] === SER[next(i1)][1]) {
                deletepile[ deletepile.length ] = i1;
            }
            points[i1] = [SER[i1][0], SER[i1][1]];
            // round it
        }
        let rect = [
            [],
            // x coordinates
            []
            // y coordinates
        ];
        for(i1 = points.length - 1; i1 >= 0; i1--) {
        // splice, create rect
            if(deletepile.includes(i1)) {
                points.splice(i1, 1)
            }
            else {
                rect[0][ rect[0].length ] = points[i1][0];
                rect[1][ rect[1].length ] = points[i1][1];
            }
        }
        center = _2dPoly.center(points);
        if(points.length === 0) {
            return {
                within: [],
                delete: deletepile,
                center,
                rect: {
                    x: null,
                    y: null,
                    w: 0,
                    h: 0,
                },
            };
        }
        else if(points.length === 1) {
            return {
                within: [include_edge],
                delete: deletepile,
                center,
                rect: {
                    x: points[0],
                    y: points[1],
                    w: 1,
                    h: 1,
                },
            };
        }
        else if(points.length === 2) {
            let line = SL.new(...points[0], ...points[1], sl_center);
            let rect = {
                x: line.x,
                y: line.y,
                w: line.w,
                h: line.h,
            };
            let within = [];
            for(i1 = 0; i1 < rect.w*rect.h; i1++) {
                within[i1] = false;
            }
            if(include_edge) {
                const axisA = Number(line.h > line.w);
                for(i1 = 0; i1 < line.values.length; i1++) {
                    let temp = [i1, line.values[i1]];
                    // axisA, axisB order
                    if(axisA) {
                        temp = [temp[1], temp[0]];
                    };
                    // x, y order
                    within[ temp[1]*rect.w + temp[0] ] = true;
                }
            }
            return {
                within,
                delete: deletepile,
                center,
                rect,
            };
        };
        rect = {
            x: Math.min(...rect[0]),
            y: Math.min(...rect[1]),
            w: Math.max(...rect[0]),
            h: Math.max(...rect[1]),
        };
        rect.w -= rect.x;
        rect.h -= rect.y;
        rect.w++;
        rect.h++;
        // ++ it so it includes all edges.
        let abs_angle = [];
        // the angle from each point to the next point.
        let lines = [];
        for(i1 = 0; i1 < points.length; i1++) {
            let _next = next(i1);
            abs_angle[i1] = get2dangle(
                points[_next][0] - points[i1][0],
                points[_next][1] - points[i1][1]
            );
            lines[i1] = SL.new(...points[i1], ...points[next(i1)], sl_center);
            // this won't be used for a while
        }
        let rel_angle = [];
        // the difference between the two angles adjacent to a point.
        let center_angle = [];
        // the midpoint between those.
        let total = 0;
        let inverted_total = 0;
        for(i1 = 0; i1 < points.length; i1++) {
            let _prev = prev(i1);
            rel_angle[i1] = posmod(abs_angle[i1] - Angle.invert(abs_angle[_prev]), 2*Math.PI);
            // something like compare2dangle would make sure this isn't
            // reflex, but that's not how this should work.
            // - making it always go in the same direction ensures
            //   consistency. like if you run in the path of a closed shape,
            //   you'll always turn in the same direction, right? unless if
            //   one of the angles is reflex.
            center_angle[i1] = posmod(abs_angle[i1] - rel_angle[i1]/2, 2*Math.PI);
            total += rel_angle[i1];
            inverted_total += posmod(2*Math.PI - rel_angle[i1], 2*Math.PI);
        }
        if(inverted_total < total) {
        // if this is true, we accidentally made a cavity, not a shape. most
        // of the angles are reflex. so invert everything.
            for(i1 = 0; i1 < points.length; i1++) {
                rel_angle[i1] = posmod(2*Math.PI - rel_angle[i1], 2*Math.PI);
                center_angle[i1] = Angle.invert(center_angle[i1]);
            }
        }
        let within = [];
        for(i1 = 0; i1 < rect.w*rect.h; i1++) {
            within[i1] = true;
        }
        // an array of numbers for each pixel of the rect
        let validity = (value) => value === 1 || (value === 0 && include_edge);
        let reflex = (index) => rel_angle[index] > Math.PI;
        for(i1 = 0; i1 < points.length; i1++) {
        // for each point, create a line for each side, combine the two
        // checks, and apply that to the within array.
            const _reflex = reflex(i1);
            const prev_reflex = reflex(prev(i1));
            let ref_x = Math.floor(points[i1][0] + 1000000000*Math.cos(center_angle[i1]));
            let ref_y = Math.floor(points[i1][1] + 1000000000*Math.sin(center_angle[i1]));
            // place it between the two sides, and ridiculously far away so
            // that rounding decay doesn't place it on one of the lines
            let prev_check = null;
            let check = SL.check(
                lines[i1],
                ref_x,
                ref_y,
                rect.x, rect.y, rect.w, rect.h
            );
            // arrays with values for each pixel. 0 for pixels on the line,
            // 1 for pixels on the same side as ref_x/ref_y, -1 for pixels
            // on the other side.
            /*
            if(i1 === points.length - 1) {
                console.log(displaylineardata(check, rect.w, (value) => value === -1 ? "-" : "o"));
            }
            //*/
            if(_reflex) {
            // it fails if it fails both sides.
                prev_check = SL.check(
                    lines[prev(i1)],
                    ref_x,
                    ref_y,
                    rect.x, rect.y, rect.w, rect.h
                );
            };
            for(i2 = 0; i2 < within.length; i2++) {
                let temp = check === null || validity(check[i2]);
                if(_reflex) {
                // if it's reflex, pixels are valid if they're on the
                // correct side of either line
                    temp = (
                        (prev_check === null || validity(prev_check[i2]))
                        ||
                        temp
                    );
                }
                else if(_reflex || prev_reflex) {
                // this is the other side of a reflex angle. it only needs
                // to be checked once, which the other side did.
                    temp = true
                }
                // otherwise, it's not part of a reflex angle. if it fails,
                // it fails.
                if(!temp) {
                    within[i2] = false;
                }
            }
        }
        return {
            delete: deletepile,
            center,
            rect,
            lines,
            within,
        };
    },
    mergedata: function(array) {
    // combines the .rects and .withins in objects created by .getdata.
    // - specifically, it starts as a rectangle big enough to contain all
    //   the rects and a matching .within filled with false values. if any
    //   of the given .withins have a point as true, that's applied to the
    //   new within.
    // - array: array of .getdatas.
        let i1 = 0;
        let i2 = 0;
        if(array.length === 0) {
            return {
                rect: {
                    x: null,
                    y: null,
                    w: 0,
                    h: 0,
                },
                within: [],
            };
        }
        let rect = [
            [],
            // all x boundaries
            []
            // all y boundaries
        ];
        for(i1 = 0; i1 < array.length; i1++) {
            rect[0][ rect[0].length ] = array[i1].rect.x;
            rect[0][ rect[0].length ] = array[i1].rect.x + array[i1].rect.w;
            rect[1][ rect[1].length ] = array[i1].rect.y;
            rect[1][ rect[1].length ] = array[i1].rect.y + array[i1].rect.h;
        }
        rect = {
            x: Math.min(...rect[0]),
            y: Math.min(...rect[1]),
            w: Math.max(...rect[0]),
            h: Math.max(...rect[1]),
        };
        rect.w -= rect.x;
        rect.h -= rect.y;
        let within = [];
        for(i1 = 0; i1 < rect.w*rect.h; i1++) {
            within[i1] = false;
            const x = rect.x + i1%rect.w;
            const y = rect.y + Math.floor(i1/rect.w);
            for(i2 = 0; i2 < array.length; i2++) {
                let _rect = array[i2].rect;
                let temp = [
                    x - _rect.x,
                    y - _rect.y
                ];
                // make it relative to this rect
                if(
                    temp[0] >= 0
                    &&
                    temp[0] < _rect.w
                    &&
                    temp[1] >= 0
                    &&
                    temp[1] < _rect.h
                    &&
                    array[i2].within[ temp[1]*_rect.w + temp[0] ]
                ) {
                // if it's within bounds and that index is true, make it
                // true on the bigger rectangle and exit
                    within[i1] = true;
                    i2 += array.length;
                };
            }
        }
        //console.log(rect);
        //console.log(within);
        return {rect, within};
    },
    within: function(_within, rect, x, y) {
    // returns a boolean for whether the coordinate is inside the shape.
    // - _within, rect: .within and .rect of object created with the
    //   _2dPoly.getdata function.
        x -= rect.x;
        y -= rect.y;
        return (
            x >= 0
            &&
            x < rect.w
            &&
            y >= 0
            &&
            y < rect.h
            &&
            _within[ y*rect.w + x ]
        );
    },
    execute: function(_this, include_edge, func) {
    // execute a function on every pixel inside the shape.
    // - func: a function with parameters x and y.
    /*
    _2dPoly.execute(_this, include_edge, function(x, y) {
    })
    //*/
        let data = _2dPoly.getdata(_this, include_edge);
        _2dPoly.reexecute(data.rect, data.within, func);
    },
    reexecute: function(rect, within, func) {
    // what execute runs. all this requires is having the .within already,
    // so it only saves time for consecutive .executes on the same
    // unchanging shape.
        let i1 = 0;
        for(i1 = 0; i1 < within.length; i1++) {
            if(within[i1]) {
                func(
                    rect.x + i1%rect.w,
                    rect.y + Math.floor(i1/rect.w)
                );
            }
        }
    },
    draw: function(ctx, _this, strokeorfill, weight, offset, etc) {
    // - etc
    //   - "skiplaststroke": useful for drawing a shape that's part of
    //     something bigger. (like a nose or ear. i'm writing this for
    //     face3d.)
        strokeorfill = ["stroke", "fill", "both"].includes(strokeorfill) ? strokeorfill : "fill";
        function stroke() {
            if(weight) {
                let temp = ctx.fillStyle;
                ctx.fillStyle = ctx.strokeStyle;
                _2dPoly.linespecial(function(x, y, progress) {
                    circledraw(ctx, x, y, weight/2, true);
                }, _this, _2dPoly.center(_this), offset, etc.includes("skiplaststroke"));
                ctx.fillStyle = temp;
            }
            else {
                _2dPoly.linespecial(ctx, _this, _2dPoly.center(_this), offset, etc.includes("skiplaststroke"));
            }
        };
        if(!offset) {
            offset = [0, 0];
        }
        etc ??= [];
        if(typeof etc === "string") {
            etc = [etc];
        };
        if(_this.length < 3) {
            if(["stroke", "both"].includes(strokeorfill)) {
                if(_this.length === 1) {
                    let temp = ctx.fillStyle;
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.fillRect(
                        offset[0] + _this[0][0],
                        offset[1] + _this[0][1],
                    1, 1);
                    ctx.fillStyle = temp;
                }
                else if(_this.length === 2) {
                    stroke();
                };
            };
            return;
        }
        else {
            if(["fill", "both"].includes(strokeorfill)) {
                _2dPoly.execute(_this, false, function(x, y) {
                    ctx.fillRect(offset[0] + x, offset[1] + y, 1, 1);
                });
            };
            if(["stroke", "both"].includes(strokeorfill)) {
                stroke();
            };
        };
    },
    convexed: function(points, viewer, offset) {
    // input a set of 3d points, (for example, the .points of a Poly) and
    // it'll return an identical _2dPoly that can be drawn much faster, at
    // the cost of no edges, lighting, texturing, etc.
    // - NOTE it cannot accurately depict concave features, or gaps of any
    //   kind, really. picture your shape inside a hollow sphere of rubber
    //   that shrinks until it can't shrink any more. if that'd change its
    //   silhouette, this will be inaccurate. can't draw interior lines
    //   either, like the edges of a cube.
    // - previously known as "cheap3dpoly", since it can be used to draw
    //   basic 3d shapes much faster than Poly. very simple 3d that just
    //   involves a sphere or a box or something like that.
    //   - Poly.draw is inefficient for that because it has to run through
    //     tons of logic and run _2dPoly.draw for every single triangle. in
    //     the case of a spheroid with 16 fineness, that's 240 triangles,
    //     and i use it on an armature of 23 spheroids.
    // - instead what this does is...
    //   - perspective convert every point
    //   - find the center
    //   - find the point furthest from the center
    //   - from there, find all the other points that should be part of the
    //     final outline. (it's hard to explain)
    // - if viewer is false, it'll just get rid of the z.
    // - if a coordinate is 2d, it'll use 0 for the z.
    // -
    //   - that is
        let i1 = 0;
        let i2 = 0;
        offset = (
            Array.isArray(offset) && offset.length >= 2
            ?
            (offset.length === 2 ? [offset[0], offset[1], 0] : offset)
            :
            [0, 0, 0]
        );
        let _points = [];
        for(i1 = 0; i1 < points.length; i1++) {
            _points[i1] = [
                offset[0] + points[i1][0],
                offset[1] + points[i1][1],
                offset[2] + (points[i1][2] ?? 0)
            ];
        }
        //console.log(_points);
        let center = [0, 0];
        for(i1 = 0; i1 < _points.length; i1++) {
            _points[i1] = (
                viewer
                ?
                perspectiveconvert(viewer, ..._points[i1])
                :
                _points[i1]
            ).slice(0, 2);
            center[0] += _points[i1][0];
            center[1] += _points[i1][1];
        }
        center[0] /= _points.length;
        center[1] /= _points.length;
        if(_points.length <= 3) {
            return _points;
        };
        let dist = null;
        let furthest = null;
        // a _points index
        for (i1 = 0; i1 < _points.length; i1++) {
            let temp = Math.hypot(_points[i1][0] - center[0], _points[i1][1] - center[1]);
            if(furthest === null || temp > dist) {
                furthest = i1;
                dist = temp;
            }
        };
        if(isNaN(dist) || typeof dist !== "number") {
            console.log("this shouldn't happen");
            return [];
        };
        let outline = [];
        outline[0] = furthest;
        // for now, it's an array of indexes
        let loopexit = false;
        for (i1 = 0; !loopexit; i1++) {
            let currindex = outline[outline.length - 1];
            let currpoint = _points[currindex];
            let idealangle = null;
            if(outline.length < 2) {
                idealangle = [
                    currpoint[0] - center[0],
                    currpoint[1] - center[1]
                ];
                idealangle = (get2dangle(...idealangle, true) + Math.PI/2)%(2*Math.PI);
                // an angle perpendicular to the angle from the center to the
                // current point.
            }
            else {
                idealangle = [
                    currpoint[0] - _points[ outline[outline.length - 2] ][0],
                    currpoint[1] - _points[ outline[outline.length - 2] ][1]
                ];
                idealangle = get2dangle(...idealangle, true);
                // the angle of the most recent line segment.
            };
            // it judges which point should be the next by getting the angle
            // from the current point to that one and subtracting the
            // idealangle. (and posmoding it) lower is better.
            let lowestangle = null;
            let nextpoint = null;
            for (i2 = 0; i2 < _points.length; i2++) {
                let temp = [
                    _points[i2][0] - currpoint[0],
                    _points[i2][1] - currpoint[1]
                ];
                if(typeof temp[0] !== "number" || typeof temp[1] !== "number") {
                    console.log(temp);
                }
                temp = get2dangle(...temp, true);
                if(typeof temp !== "string") {
                    //temp = Math.abs(temp - idealangle);
                    temp = posmod(temp - idealangle, 2*Math.PI);
                    if(temp < lowestangle || lowestangle === null) {
                        nextpoint = i2;
                        lowestangle = temp;
                    };
                }
            }
            if(nextpoint === outline[0] || nextpoint === null) {
                loopexit = true;
            }
            else if(!compareobject(currpoint, _points[nextpoint])) {
                outline[outline.length] = nextpoint;
            };
            if(outline.length > _points.length) {
            // then clearly something screwed up, so log it and let's escape
            // infinite loop hell
                console.log("this shouldn't happen");
                console.log(points);
                console.log(_points);
                loopexit = true;
            };
        }
        //console.log(_points);
        //console.log(outline);
        for (i1 = 0; i1 < outline.length; i1++) {
            outline[i1] = structuredClone(_points[ outline[i1] ]);
            // convert to coordinates
        }
        return outline;
    },
    distfromedge: function(_this, x, y) {
    // NOTE this doesn't care if it's inside the shape or not.
        let i1 = 0;
        let dist = null;
        for (i1 = 0; i1 < _this.length; i1++) {
            let next = (i1 + 1)%_this.length;
            let line = Line.frompoints(
                [
                    _this[i1][0],
                    _this[i1][1],
                    0
                ],
                [
                    _this[next][0],
                    _this[next][1],
                    0
                ]
            );
            let places = [
                line.findplace([_this[next][0], _this[next][1], 0]),
                line.findplace([x, y, 0]),
            ];
            let temp = null;
            if(places[1] < 0) {
            // past the beginning
                temp = structuredClone(_this[i1]);
            }
            else if(places[1] > places[0]) {
            // past the end
                temp = structuredClone(_this[next]);
            }
            else {
                temp = line.findposition(places[1]);
            };
            temp = Math.hypot(temp[0] - x, temp[1] - y);
            if(dist === null || temp < dist) {
                dist = temp;
            };
        };
        return dist;
    },
    linespecial(code, points, center, offset, skiplaststroke) {
    // draws linespecials to connect all the points.
        let i1 = 0;
        center ??= _2dPoly.center(_this);
        offset ??= [0, 0];
        for(i1 = 0; i1 < points.length - !!skiplaststroke; i1++) {
            linespecial(code,
                points[i1][0] + offset[0],
                points[i1][1] + offset[1],
                points[(i1 + 1)%points.length][0] + offset[0],
                points[(i1 + 1)%points.length][1] + offset[1],
            center);
        }
    },
    center: function(_this) {
        let center = [0, 0];
        for(i1 = 0; i1 < _this.length; i1++) {
            center[0] += _this[i1][0];
            center[1] += _this[i1][1];
        }
        center[0] /= _this.length;
        center[1] /= _this.length;
        return center;
    },
};
function addspheroids(points, fineness) {
// the first three numbers of each point are coordinates, the rest are
// parameters for turning points into spheroid-shaped arrangements of
// points.
// - if one number is given for a spheroid, it'll be used as a diameter
// - if three are given, it's used as width, height, and depth
// - if four are given, the fourth is assumed to be an orientation
//   quaternion.
// - fineness is how many sides a circle has. higher numbers will be more
//   detailed spheres with more points.
// - NOTE if fineness is 0, it uses an entirely different process, returning
//   every non-decimal position on the outside of the spheroid. it's more
//   taxing at higher resolutions, but it should look flawless. (it might
//   mean less points than the usual process too, if the resolution is low
//   enough.)
    let i1 = 0;
    let i2 = 0;
    fineness = Number.isInteger(Math.round(fineness)) ? fineness : 16;
    // avoid non-numbers and values like Infinity or NaN
    //console.log(new Date().valueOf());
    if(fineness !== 0) {
        fineness = Math.round(Math.abs(fineness)/4)*4;
    };
    const circle = [];
    for(i1 = 0; i1 < fineness; i1++) {
        circle[circle.length] = [
            Math.cos(2*Math.PI*i1/fineness),
            Math.sin(2*Math.PI*i1/fineness)
        ];
    }
    const sphere = [];
    for(i1 = 0; i1 <= fineness/2; i1++) {
        if(i1 === 0) {
            sphere[sphere.length] = [0, -1, 0];
        }
        else if(i1 === fineness/2) {
            sphere[sphere.length] = [0, 1, 0];
        }
        else {
            let angle = Math.PI*(-1/2 + i1/(fineness/2));
            let y = Math.sin(angle);
            let r = Math.cos(angle);
            //console.log("y, r: " + [y, r]);
            //let antitrunc = (number) => number%1 ? Math[Math.sign(number) === -1 ? "floor" : "ceil"](number) : number;
            // moves it away from zero, instead.
            for(i2 = 0; i2 < circle.length; i2++) {
                sphere[sphere.length] = [
                    circle[i2][0]*r,
                    y,
                    circle[i2][1]*r
                ];
            }
        };
        //console.log(Math.hypot(...sphere[sphere.length - 1]));
    }
    function make_spheroid(array) {
    // array should be [x, y, z, w, h, d, orient]
        array[2] ??= 0;
        if(array.length < 4) {
            return structuredClone(array);
        }
        let w = array[3];
        let h = array[4] ?? array[3];
        let d = array[5] ?? array[3];
        w++;
        h++;
        d++;
        // the reason for the +1 is the same as when circledraw adds .5 to
        // the radius. it seems weird, but it looks off otherwise. if you
        // graph a circle on a graphing calculator and zoom in, you might
        // understand why.
        let orient = array[6] ?? null;
        let offset = array.slice(0, 3);
        if(fineness === 0) {
            let within = {};
            // - [x coordinates]
            //   - [y coordinates]: arrays of z coordinates
            // - contains every integer position that's within the spheroid.
            let checker = (x, y, z) => (within.hasOwnProperty(x) && within[x].hasOwnProperty(y) && within[x][y].includes(z));
            // checks if a point exists in within.
            let inverse = orient ? Quat.invert(orient) : null;
            for(let i1 = 0; i1 <= Math.floor(w); i1++) {
                for(let i2 = 0; i2 <= Math.floor(h); i2++) {
                    for(let i3 = 0; i3 <= Math.floor(d); i3++) {
                        let num = [i1, i2, i3];
                        if(orient) {
                            num = Quat.apply(inverse, [i1, i2, i3]);
                        };
                        if(roundspecial(Math.hypot(2*num[0]/w, 2*num[1]/h, 2*num[2]/d)) <= 1) {
                            for(let i4 = 0; i4 < 2**3; i4++) {
                                let coor = [i1, i2, i3];
                                if(Math.floor((i4%(2**3))/(2**2))) {
                                    coor[0] *= -1;
                                };
                                if(Math.floor((i4%(2**2))/(2**1))) {
                                    coor[1] *= -1;
                                };
                                if(Math.floor((i4%(2**1))/(2**0))) {
                                    coor[2] *= -1;
                                };
                                if(!checker(...coor)) {
                                    within[coor[0]] ??= {};
                                    within[coor[0]][coor[1]] ??= [];
                                    within[coor[0]][coor[1]][ within[coor[0]][coor[1]].length ] = i3;
                                };
                            }
                            // since all that matters is absolute distance, every
                            // combination of inverted coordinates should have the
                            // same validity as the original.
                        }
                    }
                }
            }
            // add every single valid position.
            let shape = [];
            for(let i1 in within) {
                if(within.hasOwnProperty(i1)) {
                    for(let i2 in within[i1]) {
                        if(within[i1].hasOwnProperty(i2)) {
                            for(let i3 = 0; i3 < within[i1][i2].length; i3++) {
                                let x = Number(i1);
                                let y = Number(i2);
                                let z = within[i1][i2][i3];
                                if(
                                    !checker(x + 1, y, z)
                                    ||
                                    !checker(x - 1, y, z)
                                    ||
                                    !checker(x, y + 1, z)
                                    ||
                                    !checker(x, y - 1, z)
                                    ||
                                    !checker(x, y, z + 1)
                                    ||
                                    !checker(x, y, z - 1)
                                ) {
                                // it's on the outside if at least one
                                // cardinal neighbor doesn't exist.
                                    shape[shape.length] = [
                                        offset[0] + x,
                                        offset[1] + y,
                                        offset[2] + z
                                    ];
                                }
                            }
                        }
                    }
                }
            }
            return shape;
        }
        else {
            let shape = [];
            for(let i1 = 0; i1 < sphere.length; i1++) {
                shape[i1] = [
                    Math.trunc(offset[0] + sphere[i1][0]*w/2),
                    Math.trunc(offset[1] + sphere[i1][1]*h/2),
                    Math.trunc(offset[2] + sphere[i1][2]*d/2)
                ];
            }
            return (
                orient
                ?
                Quat.orient(orient, shape)
                :
                shape
            );
        }
    }
    let _points = [];
    for (i1 = 0; i1 < points.length; i1++) {
    // fill _points with spheroids or points
        let old_length = _points.length;
        if(points[i1].length >= 4) {
            _points = _points.concat( make_spheroid(points[i1]) );
        }
        else {
            _points[_points.length] = structuredClone(points[i1]);
            _points[_points.length - 1][2] ??= 0;
        };
    };
    return _points;
};
let Color = {
// pseudoclass for colors.
    rgb: function(ctx, color, hexcode) {
    // hexcode: if true, it'll return a code like "#ffffff" instead of [255,
    // 255, 255]
        let temp = "0123456789abcdefABCDEF";
        temp = (
            color[0] === "#"
            &&
            (
                color.length === 7
                ||
                (color.length === 9 && temp.includes(color[7]) && temp.includes(color[8]))
            )
            &&
            temp.includes(color[1])
            &&
            temp.includes(color[2])
            &&
            temp.includes(color[3])
            &&
            temp.includes(color[4])
            &&
            temp.includes(color[5])
            &&
            temp.includes(color[6])
        );
        if(!temp) {
            let temp = ctx.fillStyle;
            ctx.fillStyle = color;
            color = ctx.fillStyle;
            ctx.fillStyle = temp;
        };
        let rgb = [
            parseInt(color.slice(1, 3), 16),
            parseInt(color.slice(3, 5), 16),
            parseInt(color.slice(5, 7), 16)
        ];
        if(color.length === 9) {
            rgb[3] = parseInt(color.slice(7, 9), 16);
        }
        if(hexcode) {
            const digits = "0123456789abcdef";
            for(let i1 = 0; i1 < rgb.length; i1++) {
                rgb[i1] = digits[Math.floor(rgb[i1]/16)] + digits[rgb[i1]%16];
            }
            rgb = "#" + rgb.join("");
        }
        return rgb;
    },
    random: function(amount, dark, light) {
    // dark, light: booleans for whether it should add an especially
    // dark or light color to the mix.
        let array = [];
        let length = amount ?? 1;
        for(let i1 = 0; i1 < length; i1++) {
            let temp = (
                dark && i1 === 0
                ?
                randexponent(2)
                // mostly black
                :
                light && i1 === length - 1
                ?
                (1 - randexponent(2))
                // mostly white
                :
                (.5 + randexponent(3, true)/2)
            );
            array[i1] = [
                Math.floor(Math.random()*360),
                Math.round((1 - randexponent(1))*100),
                Math.round(temp*100)
            ];
            // hue, saturation, lightness
        }
        array.sort((a, b) => b[2] - a[2]);
        // sort by lightness
        for(let i1 = 0; i1 < length; i1++) {
            array[i1] = "hsl(" + array[i1][0] + "," + array[i1][1] + "%," + array[i1][2] + "%)";
        }
        return (
            amount === null || amount === undefined
            ?
            array[0]
            :
            array
        );
    },
    multiply: function(ctx, color1, color2) {
        color1 = Color.rgb(ctx, color1);
        color2 = Color.rgb(ctx, color2);
        let color = [];
        for(let i1 = 0; i1 < 3; i1++) {
            color[i1] = (color1[i1]/255)*(color2[i1]/255);
            color[i1] = Math.round(color[i1]*255);
        }
        return "rgb(" + color.join() + ")";
    },
    palette: function(ctx, a, b, c, skin, outline, wildcard) {
    // creates a 16-color palette with a certain style to it. meant for
    // character pixel art.
    // - three base colors
    // - multiplications of those
    // - skin and outline colors
    // - squarings of the base, skin, and outline colors
    // - transparent
    // - white
    // - and one spare color.
        let temp = Color.random(3);
        a ??= temp[0];
        b ??= temp[1];
        c ??= temp[2];
        skin ??= "#6f9f9f";
        outline ??= Color.random(null, true);
        wildcard ??= Color.random();
        let multiply = (color1, color2) => Color.multiply(ctx, color1, color2);
        /*
        return [
            "#00000000", "#ffffff", wildcard, outline,
            multiply(b, c), multiply(a, c), multiply(a, b), multiply(outline, outline),
            a, b, c, skin,
            multiply(a, a), multiply(b, b), multiply(c, c), multiply(skin, skin)
        ];
        // alternate order 1 (the relationships from the multiplying aren't very
        // clear.)
        return [
            "#00000000", "#ffffff", outline, multiply(outline, outline),
            a, multiply(a, a), skin, multiply(skin, skin),
            b, multiply(a, b), multiply(b, b), wildcard,
            c, multiply(a, c), multiply(b, c), multiply(c, c)
        ];
        transp	white	outl	outl^2
        a	aa	skin	skin^2
        b	ab	bb	wild
        c	ac	bc	cc
        // alternate order 2 (thought of something better)
        return [
            "#00000000", "#ffffff", multiply(c, c), outline,
            wildcard, multiply(b, b), multiply(b, c), multiply(outline, outline),
            multiply(a, a), multiply(a, b), multiply(a, c), skin,
            a, b, c, multiply(skin, skin)
        ];
        // 3
        transp  white   cc      outl
        wild    bb      bc      outl^2
        aa      ab      ac      skin
        a       b       c       skin^2
        //*/
        return [
            "#00000000", "#ffffff", c, outline,
            wildcard, b, multiply(b, c), multiply(outline, outline),
            a, multiply(a, b), multiply(a, c), skin,
            multiply(a, a), multiply(b, b), multiply(c, c), multiply(skin, skin)
        ];
    },
};
const Raster = {
// pseudoclass for an array that represents an image. each value is the color of
// a pixel.
// - used in aa.
    redimension: function(_this, w, new_w, new_h) {
        let i1 = 0;
        if(_this.length === 0) {
            let __this = [];
            for(i1 = 0; i1 < new_w*new_h; i1++) {
                __this[i1] = 0;
            }
            return __this;
        };
        let h = Math.ceil(_this.length/w);
        let __this = structuredClone(_this);
        function oddness_change(_this, w, x_change, y_change) {
        // when an image designed to center around a [.0, .0, .0] point is
        // moved to a [.5, .5, .5] point, the dimensions have to change to
        // match. that's what this does.
        // - x_change, y_change: signs for which axes are changing and how.
        //   +1 means to add a row/column, -1 means to get rid of one.
        // - if there's two center rows/columns, it makes a new one where
        //   every pixel has the value of the higher of the two
        //   counterparts. if the sign is positive, that's added. if it's
        //   negative, it replaces both of its neighbors.
        // - if there's one center row/column, that's either duplicated or
        //   deleted.
        // - NOTE if the image has fill, it'll get rid of it and rerun .fill
        //   after the edits, but that isn't foolproof if the running of
        //   .fill from before just didn't find any fillable pixels.
            let i1 = 0;
            let i2 = 0;
            let __this = structuredClone(_this);
            let h = Math.ceil(__this.length/w);
            if(![-1, 0, 1].includes(x_change) || ![-1, 0, 1].includes(y_change)) {
                console.log("x_change and y_change have to be -1, 0, or 1.");
                return __this;
            }
            else if(!x_change && !y_change) {
                return __this;
            };
            if(_this.length === 0) {
                return (x_change === 1 && y_change === 1 ? [1] : []);
            };
            const filled = __this.includes("fill");
            // reverses .fill, then reapplies it at the end
            if(filled) {
                for(i1 = 0; i1 < __this.length; i1++) {
                    if(__this[i1] === "fill") {
                        __this[i1] = 1;
                    }
                }
            };
            // clear fill
            if(x_change) {
                let odd = !!(w%2);
                for(i1 = 0; i1 < __this.length; i1 += w + x_change) {
                // iterate by row
                    if(odd) {
                        index = i1 + (w - 1)/2;
                        if(x_change === 1) {
                        // duplicate
                            __this.splice(index, 0, __this[index]);
                        }
                        else if(x_change === -1) {
                        // delete
                            __this.splice(index, 1);
                        }
                    }
                    else {
                        index = i1 + w/2 - 1;
                        const value = Math.max(__this[index], __this[index + 1]);
                        // combine
                        if(x_change === 1) {
                        // insert it
                            __this.splice(index + 1, 0, value);
                        }
                        else if(x_change === -1) {
                        // replace the middle two with it
                            __this.splice(index, 2, value);
                        }
                    };
                }
                w += x_change;
                // for the y_change logic
            };
            if(y_change) {
                let odd = !!(h%2);
                if(odd) {
                    let start = w*(h - 1)/2;
                    let end = start + w;
                    // start and end of the middle row
                    if(y_change === 1) {
                    // duplicate
                        __this = __this.slice(0, start).concat(
                            __this.slice(start, end)
                        ).concat(
                            __this.slice(start, end)
                        ).concat(
                            __this.slice(end)
                        );
                    }
                    else if(y_change === -1) {
                    // delete
                        __this = __this.slice(0, start).concat( __this.slice(end) );
                    }
                }
                else {
                    let middle = w*h/2;
                    let start = middle - w;
                    let end = middle + w;
                    // start, middle, and end of the middle rows
                    let value = [];
                    for(i1 = 0; i1 < w; i1++) {
                        value[i1] = Math.max(__this[start + i1], __this[middle + i1]);
                    };
                    // combine
                    if(y_change === 1) {
                    // insert it
                        __this = __this.slice(0, middle).concat(
                            value
                        ).concat(
                            __this.slice(middle)
                        );
                    }
                    else if(y_change === -1) {
                    // replace the middle two with it
                        __this = __this.slice(0, start).concat(
                            value
                        ).concat(
                            __this.slice(end)
                        );
                    }
                };
                h += y_change;
            }
            //
            if(filled) {
                __this = Raster.fill(__this, w);
            };
            return __this;
        };
        let change = [
            new_w - w,
            new_h - h
        ];
        let ones = [
            change[0]%2,
            change[1]%2
        ];
        let twos = [
            (change[0] - ones[0])/2,
            (change[1] - ones[1])/2
        ];
        if(twos[0] || twos[1]) {
            __this = Raster.addrowcol(__this, w, twos[0], twos[0], twos[1], twos[1]);
            w += 2*twos[0];
            h += 2*twos[1];
        };
        if(ones[0] || ones[1]) {
            __this = oddness_change(__this, w, ...ones);
            w += ones[0];
            h += ones[1];
        };
        if(__this.length !== new_w*new_h || w !== new_w || h !== new_h) {
            console.log("this shouldn't happen");
            logspecial({w, new_w, h, new_h, _this_length: __this.length});
        };
        return __this;
    },
    addrowcol: function(_this, w, l, r, u, d) {
    // adds or removes blank rows/columns.
        let i1 = 0;
        l = typeof l === "number" ? Math.trunc(l) : 0;
        r = typeof r === "number" ? Math.trunc(r) : 0;
        u = typeof u === "number" ? Math.trunc(u) : 0;
        d = typeof d === "number" ? Math.trunc(d) : 0;
        function arrayrepeat(value, number) {
            let i1 = 0;
            let array = [];
            if(!Number.isInteger(Math.floor(number))) {
            // some kinda weird ass number like
            // infinity or nan
                return;
            };
            for(i1 = 0; i1 < number; i1++) {
                array[i1] = structuredClone(value);
            }
            return array;
        };
        let __this = structuredClone(_this);
        if(l || r) {
            for(i1 = 0; i1 < __this.length; i1 += l + w + r) {
                if(l > 0) {
                    __this = __this.slice(0, i1).concat( arrayrepeat(0, l) ).concat( __this.slice(i1) );
                }
                else if(l < 0) {
                    __this = __this.slice(0, i1).concat( __this.slice(i1 - l) );
                };
                if(r > 0) {
                    __this = __this.slice(0, i1 + l + w).concat( arrayrepeat(0, r) ).concat( __this.slice(i1 + l + w) );
                }
                else if(r < 0) {
                    __this = __this.slice(0, i1 + l + w).concat( __this.slice(i1 + l + w - r) );
                };
            };
            w += l + r;
        };
        if(u > 0) {
            __this = arrayrepeat(0, u*w).concat(__this);
        }
        else if(u < 0) {
            __this = __this.slice(-u*w);
        };
        if(d > 0) {
            __this = __this.concat(arrayrepeat(0, d*w));
        }
        else if(d < 0) {
            __this = __this.slice(0, d*w);
        };
        return __this;
    },
    ellipse: function(_this, w, x1, y1, x2, y2) {
    // used in aa.pa.ellipse(). takes an array and turns indexes
    // within the specified ellipse into 1.
    // - all coordinates are relative to the top left corner of the
    //   shape, not the center.
        let i1 = 0;
        const center = [
            (x1 + x2)/2,
            (y1 + y2)/2,
        ];
        const r = [
            Math.abs(x1 - x2)/2 + .5,
            Math.abs(y1 - y2)/2 + .5
        ];
        let __this = structuredClone(_this);
        for (i1 = 0; i1 < __this.length; i1++) {
            let hypot = [
                i1 % w,
                Math.floor(i1/w)
            ];
            hypot = Math.hypot(
                (hypot[0] - center[0])/r[0],
                (hypot[1] - center[1])/r[1]
            );
            // not 100% sure of this math because i only just thought of
            // it
            if(hypot <= 1) {
                __this[i1] = 1;
            };
            // if it's within the ellipse, fill it.
        };
        return __this;
    },
    clear: function(_this) {
        let __this = [];
        for(let i1 = 0; i1 < _this.length; i1++) {
            __this[i1] = 0;
        }
        return __this;
    },
    mirror: function(_this, w, axis) {
        let i1 = 0;
        const h = Math.ceil(_this.length/w);
        let array = [];
        for(i1 = 0; i1 < _this.length; i1++) {
            let coor = [
                i1 % w,
                Math.floor(i1/w)
            ];
            if(axis === "x") {
                coor[0] = (w - 1) - coor[0];
            };
            if(axis === "y") {
                coor[1] = (h - 1) - coor[1];
            };
            array[i1] = _this[ w*coor[1] + coor[0] ];
        };
        return array;
    },
    xmirror: (_this, w) => Raster.mirror(_this, w, "x"),
    // by x i mean screen x. you know, z if it's the right view...
    ymirror: (_this, w) => Raster.mirror(_this, w, "y"),
    move: function(_this, w, x_move, y_move) {
        let i1 = 0;
        let i2 = 0;
        const h = Math.ceil(_this.length/w);
        if(x_move === 0 && y_move === 0) {
            return structuredClone(_this);
        };
        if(Math.abs(x_move) >= w || Math.abs(y_move) >= h) {
            return Raster.clear(_this);
        };
        let __this = Raster.clear(_this);
        for(i1 = 0; i1 < _this.length; i1++) {
            let _x = (i1%w) + x_move;
            let _y = Math.floor(i1/w) + y_move;
            if(_x >= 0 && _x < w && _y >= 0 && _y < h) {
                __this[ w*_y + _x ] = _this[i1];
            }
        }
        return __this;
    },
    outline: function(_this, w) {
    // returns a matching array of booleans for whether each pixel is an outline
    // or not. pixels count as outlines if they aren't falsy and have at least
    // one falsy cardinal neighbor. used in fill and the aa silhouette creation.
        let i1 = 0;
        let array = [];
        const h = Math.ceil(_this.length/w);
        for(i1 = 0; i1 < _this.length; i1++) {
            let _x = i1%w;
            let _y = Math.floor(i1/w);
            array[i1] = !!(
                _this[i1]
                &&
                (
                    [0, w - 1].includes(_x)
                    ||
                    [0, h - 1].includes(_y)
                    ||
                    !_this[i1 - w]
                    ||
                    !_this[i1 + w]
                    ||
                    !_this[i1 - 1]
                    ||
                    !_this[i1 + 1]
                )
            );
            // a non-falsy pixel that's on the edge of the image or has
            // a falsy neighbor
        }
        return array;
    },
    rotate: function(_this, w, angle, x, y) {
        let starttime = new Date().valueOf();
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        const h = Math.ceil(_this.length/w);
        x ??= w/2;
        y ??= h/2;
        // center
        let __this = [];
        let value2 = [];
        for(i1 = 0; i1 < _this.length; i1++) {
            __this[i1] = 0;
        }
        const x_line = new Line(0, 0, 0, [angle, 0]);
        const y_line = new Line(0, 0, 0, [posmod(angle + Math.PI/2, 2*Math.PI), 0]);
        // used to check if a point is within a square.
        for(i1 = 0; i1 < _this.length; i1++) {
        // points of value 1 or 2 get turned into points and rotated.
        // - every pixel is evaluated for whether it's within one of the
        //   squares these represent. if so, they are set as 1.
        // - then value2 pixels get .5'd and rounded. if it's within the
        //   rectangle, that pixel is set as 2.
            if(_this[i1]) {
                const point = revolve(
                    angle,
                    [
                        i1%w,
                        Math.floor(i1/w),
                        0
                    ],
                    [x, y, 0],
                    "xy"
                ).slice(0, 2);
                const x_range = [
                    Math.ceil((point[0] - Math.SQRT2) - .5) + .5,
                    Math.floor((point[0] + Math.SQRT2) + .5) - .5
                ];
                const y_range = [
                    Math.ceil((point[1] - Math.SQRT2) - .5) + .5,
                    Math.floor((point[1] + Math.SQRT2) + .5) - .5
                ];
                for(i2 = x_range[0]; i2 <= x_range[1]; i2++) {
                    for(i3 = y_range[0]; i3 <= y_range[1]; i3++) {
                        let dist = [
                            i2 - point[0],
                            i3 - point[1],
                            0
                        ];
                        dist = [
                            x_line.findplace(dist),
                            y_line.findplace(dist)
                        ];
                        if(
                            dist[0] >= 0
                            &&
                            dist[0] < 1
                            &&
                            dist[1] >= 0
                            &&
                            dist[1] < 1
                        ) {
                            let coor = [Math.round(i2 - .5), Math.round(i3 - .5)];
                            if(
                                coor[0] >= 0
                                &&
                                coor[0] < w
                                &&
                                coor[1] >= 0
                                &&
                                coor[1] < h
                            ) {
                                __this[ coor[1]*w + coor[0] ] = _this[i1];
                            }
                        };
                    }
                }
                // search all .5 coordinates within Math.SQRT2 from the
                // point.
                if(_this[i1] === 2) {
                    value2[value2.length] = structuredClone(point);
                };
            }
        };
        //console.log("Raster.rotate() took " + (new Date().valueOf() - starttime)/1000 + " seconds.");
        return __this;
    },
    totext: function(_this, w) {
        let text = "";
        for(i1 = 0; i1 < _this.length; i1++) {
            if(i1 !== 0 && i1%w === 0) {
                text += String.fromCharCode(10);
            };
            if(_this[i1] === "fill") {
                text += "%";
            }
            else {
                text += "-%*"[_this[i1]];
            };
        };
        return text;
    },
    fromtext: function(text, shush) {
    // returns an object of _this and w.
        let i1 = 0;
        let i2 = 0;
        if(!text) {
            return [];
        };
        text = trimspecial(text, null);
        const w = text[0].length;
        for(i1 = 1; i1 < text.length; i1++) {
            if(text[i1].length !== w) {
                if(!shush) {
                    console.log("inconsistent raster w.");
                };
                return null;
            };
        }
        text = text.join("");
        let raster = [];
        for(i1 = 0; i1 < text.length; i1++) {
            raster[i1] = "-%*".indexOf(text[i1]);
            if(raster[i1] === -1) {
                if(!shush) {
                    console.log("invalid character. only -, %, and * are accepted.");
                }
                return null;
            }
        }
        return {raster, w};
    },
    indextocoord: function(index, rect) {
        return [
            rect.x + (index%rect.w),
            rect.y + Math.floor(index/rect.w)
        ];
    },
    _2dPoly: function(_this, rect, multiple) {
    // converts a raster into a series of points forming a closed shape
    // - multiple: by default, it only returns a single shape, even if
    //   the raster contains multiple closed shapes. it uses
    //   _2dPoly.convexed to make it.
        let i1 = 0;
        let i2 = 0;
        let loop = new Loop("Raster._2dPoly");
        if(typeof rect === "number") {
            rect = [rect, Math.ceil(_this.length/rect)];
        };
        if(Array.isArray(rect)) {
            rect = Raster.dimrect(...rect);
        };
        let temp = Raster.outline(_this, rect.w);
        let outline = multiple ? {} : [];
        // if multiple:
        // - x coordinates
        //   - y coordinates: value is a boolean for whether it's been
        //     used in the shape yet
        for(i1 = 0; i1 < temp.length; i1++) {
            loop.tick(1);
            if(temp[i1]) {
                let x = rect.x + (i1%rect.w);
                let y = rect.y + Math.floor(i1/rect.w);
                if(multiple) {
                    outline[x] ??= {};
                    outline[x][y] = false;
                }
                else {
                    outline[outline.length] = [x, y];
                }
            }
        }
        loop.end();
        if(!multiple) {
            return _2dPoly.convexed(outline);
        }
        const dircoor = [];
        for(let dir = 0; dir < 8; dir++) {
            loop.tick(1);
            dircoor[dir] = [
                0 + (posmod(dir - 7, 8) <= 2) - (posmod(dir - 3, 8) <= 2),
                0 + (posmod(dir - 1, 8) <= 2) - (posmod(dir - 5, 8) <= 2)
            ];
        }
        loop.end();
        // 0 +0
        // 1 ++
        // 2 0+
        // 3 -+
        // 4 -0
        // 5 --
        // 6 0-
        // 7 +-
        function addshape() {
        // looks for another closed shape within the outline, or returns
        // null if it can't find one.
            let i1 = 0;
            let i2 = 0;
            let loop = new Loop("Raster._2dPoly addshape");
            let shape = [];
            for(i1 in outline) {
                loop.tick(1);
                if(outline.hasOwnProperty(i1) && !shape.length) {
                    for(i2 in outline[i1]) {
                        loop.tick(2);
                        if(outline[i1].hasOwnProperty(i2) && !shape.length && !outline[i1][i2]) {
                        // start the shape with the first point you see
                        // that isn't taken.
                            shape[0] = [Number(i1), Number(i2)];
                            outline[i1][i2] = true;
                        }
                    }
                    loop.end();
                }
            }
            loop.end();
            if(shape.length === 0) {
            // no points left that aren't taken
                return null;
            }
            let loopexit = false;
            let prevdir = 0;
            // "previous direction". right is 0, down-right is 1, etc.
            let x = shape[0][0];
            let y = shape[0][1];
            // point you're getting the next point from.
            let lastchange = 0;
            // index of last direction change. used to splice out
            // unnecessary points.
            for(; !loopexit;) {
            // look for neighbors from the most recent point, and add
            // them. exit if there's none.
                loop.tick(0);
                let x = shape[shape.length - 1][0];
                let y = shape[shape.length - 1][1];
                loopexit = true;
                // gets turned off if there was a new point
                for(i1 = 0; i1 < 8; i1++) {
                // search every direction
                    loop.tick(1);
                    let dir = posmod(prevdir + i1, 8);
                    // prioritize the directions closest to the
                    // previous, clockwise.
                    let _x = x + dircoor[dir][0];
                    let _y = y + dircoor[dir][1];
                    if(outline.hasOwnProperty(_x) && outline[_x].hasOwnProperty(_y) && !outline[_x][_y]) {
                    // if this is part of the outline and hasn't been
                    // taken
                        x = _x;
                        y = _y;
                        outline[_x][_y] = true;
                        loopexit = false;
                        i1 += 8;
                        /*
                        if(prevdir === dir) {
                            if(lastchange === shape.length - 2) {
                            // only save the beginning and end of a
                            // straight line. create an end if there's
                            // more than one point in this direction,
                            // - length - 2 because the line should
                            //   start with the index *before*
                            //   lastchange.
                                shape[shape.length] = [x, y];
                            }
                            else {
                            // move that end if there's more than two
                            // points in this direction.
                                shape[shape.length - 1] = [x, y];
                            };
                        }
                        else {
                            lastchange = shape.length;
                            shape[shape.length] = [x, y];
                        };
                        */
                        // this code avoids splicing redundant pixels,
                        // but i don't feel like figuring out ::. forms
                        // and it's not worth making this function
                        // spotty.
                        prevdir = dir;
                    }
                }
                loop.end();
            }
            loop.end();
            return shape;
        };
        let shapes = [];
        // array of _2dPolys
        let loopexit = false;
        for(; !loopexit;) {
            loop.tick(1);
            shapes[shapes.length] = addshape();
            // adds a closed shape
            if(!shapes[shapes.length - 1]) {
            // means there's no points left to make a closed shape with
                shapes.splice(shapes.length - 1, 1);
                loopexit = true;
            }
        }
        loop.end();
        return shapes;
    },
    rewrite: function(_this, code) {
    // used for simple changes like setting all 2 values to 1.
        let __this = [];
        for(let i1 = 0; i1 < _this.length; i1++) {
            __this[i1] = code(_this[i1]);
        }
        return __this;
    },
    dimrect: function(w, h) {
    // converts a w and h number into a full rectangle.
        w = Math.abs(w);
        h = Math.abs(h);
        return {
            x: -(w - Math.sign(w))/2,
            y: -(h - Math.sign(h))/2,
            w,
            h,
        };
    },
    from3d: function(points, fineness, offset, viewer, etc) {
    // returns a raster and rect from a series of 3d points.
    // - points is an array of point groups.
    //   - every point group is drawn with _2dPoly.convexed, so you can create
    //     basic shapes like cubes, and any concave features can be created by
    //     putting points in separate groups.
    // - you can create spheroids by writing points with more than three values.
    //   fineness is used as an argument for addspheroids.
    // - it's an elegant system that should be able to handle a lot of basic 3d
    //   needs without breaking the bank.
    // - values are 0 if the pixel is empty, 1 if it isn't, and 2 if one of the
    //   points was there.
        //console.log("=");
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        fineness ??= 32;
        offset ??= [0, 0, 0];
        const is_aa = etc.includes("aa");
        // as in armature artist.
        // - the rectangle will be in the aa style, and the coordinates' floats
        //   will be the same as the offset's floats.
        let _points = structuredClone(points);
        let data = [];
        for(i1 = 0; i1 < _points.length; i1++) {
            for(i2 = 0; i2 < _points[i1].length; i2++) {
                let ref = _points[i1][i2];
                for(i3 = 0; i3 < 3; i3++) {
                    ref[i3] += offset[i3];
                }
                // add offset
                if(viewer && !is_aa) {
                // perspective conversion (keep the indexes past 3, since those
                // are spheroid parameters)
                    let temp = structuredClone(_points[i1][i2]);
                    //console.log(Points.subtract(_points[i1][i2], viewer));
                    _points[i1][i2] = viewer.convert(...ref.slice(0, 3)).concat( ref.slice(3) );
                    ref = _points[i1][i2];
                    //console.log(Points.subtract(_points[i1][i2], viewer));
                }
                for(i3 = 0; i3 < 3; i3++) {
                    if(is_aa) {
                    // make it relative to zero
                        ref[i3] -= offset[i3];
                    }
                    ref[i3] = roundspecial(ref[i3]);
                }
            }
            let shape = _2dPoly.convexed( addspheroids(_points[i1], fineness) );
            if(false) {
            // keep around the spheroid points so that they can be marked. (that
            // looks ugly, but it can be useful for debugging.)
                _points[i1] = structuredClone(shape);
            }
            data[i1] = _2dPoly.getdata(shape, true, null);
            //console.log(data[i1].rect);
        }
        data = _2dPoly.mergedata(data);
        let rect = structuredClone(data.rect);
        let raster = [];
        for(i1 = 0; i1 < data.within.length; i1++) {
            raster[i1] = Number(data.within[i1]);
        }
        for(i1 = 0; i1 < _points.length; i1++) {
            for(i2 = 0; i2 < _points[i1].length; i2++) {
                let coor = [
                    Math.floor(_points[i1][i2][0] - rect.x),
                    Math.floor(_points[i1][i2][1] - rect.y)
                ];
                // coordinates relative to the top left
                if(
                    coor[0] < 0 || coor[0] >= rect.w
                    ||
                    coor[1] < 0 || coor[1] >= rect.h
                ) {
                // out of bounds
                    console.log("this shouldn't happen (out of bounds Raster.from3d vertex.)");
                }
                else if(_points[i1][i2].length < 4) {
                // skip if it's a spheroid.
                    raster[coor[1]*rect.w + coor[0]] = 2;
                }
            }
        }
        return {raster, rect};
    },
};
class Trace extends Array {
// 2d shape class used in Extrude. it can use both straight lines and circular
// arcs.
// - structure of an array item:
//   - x, y
//   - link: data for how it connects to the next point.
//     - if it's null, it's a straight line
//     - if it's a number, it's interpreted as the radians for a circular arc
//       between the two points.
//       - if it's negative, it expands in the higher perpendicular direction
    constructor(array) {
    // array is optional. it can be a _2dPoly or a Trace, the result will be a
    // clone, except for invalid items.
        if(Array.isArray(array)) {
            for(let i1 = 0; i1 < array.length; i1++) {
                let obj = array[i1];
                if(Array.isArray(obj) && typeof obj[0] === "number" && typeof obj[1] === "number") {
                    this[this.length] = {
                        x: obj[0],
                        y: obj[1],
                    };
                }
                else if(
                    typeof obj === "object"
                    &&
                    typeof obj.x === "number"
                    &&
                    typeof obj.y === "number"
                ) {
                    this[this.length] = {
                        x: obj.x,
                        y: obj.y,
                        link: typeof obj.link === "number" ? obj.link : null,
                    };
                }
            }
        }
    }
    links() {
    // does the math on the links between points and saves it to an array, to
    // avoid redundant calculations.
    // - structure of one object:
    //   - always present
    //     - type
    //       - "line", "circle", "quarter", "eighth"
    //     - length: the length of the connection.
    //   - only present for circle connections
    //     - x, y: the position of the center of the circle.
    //     - r: radius
    //     - arc_size: length of the arc, measured in radians
    //     - arc_dir: direction the arc expands in
    //     - sign: 1 means you get from the beginning to the end by moving
    //       clockwise. -1 means you move counterclockwise.
        let links = [];
        for(let i1 = 0; i1 < this.length; i1++) {
            let type = this[i1].link;
            let next = (i1 + 1)%this.length;
            let dist = [
                this[next].x - this[i1].x,
                this[next].y - this[i1].y
            ];
            links[i1] = {};
            if(type === null || type === 0 || (dist[0] === 0 && dist[1] === 0)) {
                links[i1] = {
                    type: "line",
                    length: Math.hypot(...dist),
                };
            }
            else {
                if(typeof type === "number") {
                // a number. this is interpreted as how many degrees you want a
                // circular arc between these points to be. an angle measured in radians.
                    links[i1].type = "circle";
                    let angle = (get2dangle(...dist) + Math.PI/2)%(2*Math.PI);
                    // the angle should be perpendicular to the line between the
                    // beginning and end.
                    if(angle >= Math.PI) {
                        angle -= Math.PI;
                    };
                    if(type < 0) {
                        angle += Math.PI;
                    };
                    // but there's two of those. it'll pick the lower angle,
                    // unless you make the number of radians negative.
                    type = Math.abs(type)%(2*Math.PI);
                    links[i1].arc_size = type;
                    let _arc_size = type >= Math.PI ? posmod(2*Math.PI - type, 2*Math.PI) : type;
                    // if arc_size is a reflex angle, this is the matching
                    // non-reflex. that's what we need to use when doing the
                    // math for the radius.
                    links[i1].arc_dir = angle;
                    // now to find the radius.
                    // - the fact that it has to be the same distance from both
                    //   start and end limits the location to being on a line.
                    //   the expansion direction cuts that in half. all that's
                    //   left is knowing what radius it has to have to get the
                    //   arc size it needs.
                    // - picture an isosceles triangle formed by the center and
                    //   the previous/next point.
                    // - now break it in half.
                    // - side b is the Math.hypot(...dist)/2
                    // - side c is radius
                    // - angle ac is _arc_size/2
                    // - sin is the opposite/hypotenuse, so
                    // - sin(_arc_size/2) = (Math.hypot(...dist)/2)/radius
                    // - radius*sin(_arc_size/2) = Math.hypot(...dist)/2
                    // - radius = Math.hypot(...dist)/(2*sin(_arc_size/2))
                    let r = Math.hypot(...dist)/(2*Math.sin(_arc_size/2));
                    links[i1].x = this[i1].x + dist[0]/2 + r*Math.cos(angle);
                    links[i1].y = this[i1].y + dist[1]/2 + r*Math.sin(angle);
                    let temp = [
                        get2dangle(
                            this[i1].x - links[i1].x,
                            this[i1].y - links[i1].y
                        ),
                        // angle from the center to the start
                        get2dangle(
                            this[next].x - links[i1].x,
                            this[next].y - links[i1].y
                        )
                        // center to the end
                    ];
                    links[i1].sign = (
                        !roundspecial( posmod(temp[0] + arc_size, 2*Math.PI) - temp[1] )
                        // start angle plus arc size equals end angle
                        ?
                        1
                        :
                        !roundspecial( posmod(temp[0] - arc_size, 2*Math.PI) - temp[1] )
                        // start angle minus arc size equals end angle
                        ?
                        -1
                        :
                        0
                    );
                    if(!links[i1].sign) {
                    // means i screwed up somewhere.
                        console.log("this shouldn't happen");
                    };
                    links[i1].length = r*arc_size;
                    // 2*r*pi * arc_size/(2*pi)
                }
                else {
                    console.log("either " + type + " is an unfinished type of link, or you screwed up the syntax somewhere.");
                };
            }
        }
        return links;
    }
    place(num, links) {
    // input a 0 to 1 number, (0 is the beginning, 1 is the end) and it'll give
    // you the x, y, and angle of that place.
    // - angle being what direction the line is moving.
        let i1 = 0;
        num = posmod(num, 1);
        links ??= this.links();
        let length = 0;
        for(i1 = 0; i1 < links.length; i1++) {
            length += links[i1].length;
        }
        let _length = num*length;
        for(i1 = 0; i1 < links.length; i1++) {
            if(_length > links[i1].length) {
                _length -= links[i1].length;
            }
            else {
                if(!links[i1].length) {
                // zero length stuff could cause bugs, so skip ahead to the next
                // non-zero length, even if you have to wrap around.
                    i1 = null;
                    for(let i2 = 1; i2 < links.length && i1 === null; i2++) {
                        let _i2 = (i1 + i2)%links.length;
                        if(links[_i2].length) {
                            i1 = _i2;
                        }
                    }
                    if(i1 === null) {
                    // means every link has zero length.
                        return {
                            x: this[0].x,
                            y: this[0].y,
                            angle: null,
                        };
                    }
                }
                let next = (i1 + 1)%this.length;
                let _num = _length/links[i1].length;
                _length = null;
                if(links[i1].type === "line") {
                    let next = (i1 + 1)%this.length;
                    let dist = [
                        this[next].x - this[i1].x,
                        this[next].y - this[i1].y
                    ];
                    return {
                        x: this[i1].x + _num*dist[0],
                        y: this[i1].y + _num*dist[1],
                        angle: get2dangle(...dist),
                    };
                }
                else if(links[i1].type === "circle") {
                    let angle = posmod(links[i1].arc_dir - links[i1].arc_size/2, 2*Math.PI);
                    angle += _num*links[i1].arc_size*links[i1].sign;
                    let x = links[i1].x + links[i1].r*Math.cos(angle);
                    let y = links[i1].y + links[i1].r*Math.sin(angle);
                    angle += links[i1].sign*Math.PI/2;
                    return {x, y, angle};
                };
            }
        }
    }
}
class Extrude {
// 3d shape class. more limited than traditional models, but faster, and
// resolution-less like a vector image.
// - it's a 2d shape connected to another 2d shape, both perpendicular to the
//   same line.

}

let Points = {
// i used godot's vector system and now i want that.
// - b but i actually, i had actually thought of this before i used that. i'm a
//   genius, i'm above copying others or taking influence
//   - to be specific, it was the idea of doing math on number arrays
// - this is a pseudoclass that does math between two arrays that are strictly
//   numbers.
    log: function(points) {
        let array = [];
        for(let i1 = 0; i1 < points.length; i1++) {
            array[i1] = JSON.stringify(points[i1]).replaceAll(",", ", ");
        }
        return "[\n\t" + array.join(",\n\t") + "\n]";
    },
    convert: function(object) {
        if(typeof object !== "object" || Array.isArray(object)) {
            return object;
        };
        let point = [];
        for(let i1 = 0; i1 < 3; i1++) {
            if(typeof object["xyz"[i1]] === "number") {
                point[i1] = object["xyz"[i1]];
            }
            else {
                i1 += 3;
            }
        }
        return point;
    },
    apply: function(point, object) {
    // creates or modifies an object to convert the point array into x/y/z
    // letter properties.
        if(point.length > 3) {
            console.log("invalid input. outta axis letters");
        };
        object ??= {};
        for(let i1 = 0; i1 < Math.min(3, point.length); i1++) {
            object["xyz"[i1]] = point[i1];
        }
        return object;
    },
    math: function(point1, point2, operation) {
        point1 = Points.convert(point1);
        point2 = Points.convert(point2);
        if(typeof point1 === "number" && typeof point2 === "number") {
            return Points.math([point1], [point2], operation)[0];
        }
        let point = [];
        let length = Math.max(point1.length ?? 0, point2.length ?? 0);
        for(let i1 = 0; i1 < length; i1++) {
            let temp = [
                typeof point1[i1] === "number" ? point1[i1] : typeof point1 === "number" ? point1 : 0,
                typeof point2[i1] === "number" ? point2[i1] : typeof point2 === "number" ? point2 : 0
            ];
            point[i1] = (
                operation === "+" ? temp[0] + temp[1] :
                operation === "-" ? temp[0] - temp[1] :
                operation === "*" ? temp[0] * temp[1] :
                operation === "/" ? temp[0] / temp[1] :
                operation === "^" ? temp[0] ** temp[1] :
                0
            )
        }
        return point;
    },
    add: (point1, point2) => Points.math(point1, point2, "+"),
    subtract: (point1, point2) => Points.math(point1, point2, "-"),
    multiply: (point1, point2) => Points.math(point1, point2, "*"),
    divide: (point1, point2) => Points.math(point1, point2, "/"),
    exponent: (point1, point2) => Points.math(point1, point2, "^"),
    invert: (point) => Points.multiply(point, -1),
    valid: (point, length) => (
        Array.isArray(point)
        &&
        (typeof length !== "number" || point.length === length)
        &&
        point.every((element) => typeof element === "number")
    ),
    sum: function(point) {
        let num = 0;
        for(let i1 = 0; i1 < point.length; i1++) {
            num += point[i1];
        }
        return num;
    },
    sums: function(points) {
        let array = [];
        for(let i1 = 0; i1 < points.length; i1++) {
            array[i1] = Points.sum(points[i1]);
        }
        return array;
    },
    cross: function(point1, point2) {
    // cross product.
    // - the cross product is a vector that's perpendicular to the two vectors
    //   you put in. provided they weren't parallel or [0, 0, 0].
        if(point1.length !== point2.length) {
            console.log("invalid input. points must have the same number of coordinates.");
            return;
        }
        else if(point1.length !== 3) {
            console.log("invalid input. i don't know for sure how non-3d cross products work and. i don't really care");
            return;
        };
        return [
            point1[1]*point2[2] - point1[2]*point2[1],
            point1[2]*point2[0] - point1[0]*point2[2],
            point1[0]*point2[1] - point1[1]*point2[0]
        ];
    },
    dot: (point1, point2) => Points.sum(Points.multiply(point1, point2)),
    // dot product.
    // - useful in math i hate.
    // - one of its properties is that if the dot product is zero but the
    //   hypotenuses of the vectors aren't, the vectors are perpendicular.
    zero: (point) => !Math.hypot(...point),
    normalized: (point) => Points.zero(point) ? [0, 0, 0] : Points.divide(point, Math.hypot(...point)),
    parallel: function(point1, point2) {
        if(Points.zero(point1) || Points.zero(point2)) {
            return false;
        }
        let normal = [Points.normalized(point1), Points.normalized(point2)];
        return compareobject(normal[0], normal[1]) || compareobject(Points.invert(normal[0]), normal[1]);
    },
    perpendicular: (point1, point2) => !Points.zero(point1) && !Points.zero(point2) && !Points.dot(point1, point2),
    // as in "is perpendicular". use Points.zero and Points.cross if you want
    // the vector perpendicular to both.
    change: function(point1, point2) {
    // returns a {multiplier, quat} object representing what changes to make to
    // point1 to get point2.
    // - NOTE:
    //   - if point1 is [0, 0, 0], it returns a multiplier/quat that doesn't
    //     change anything at all.
    //   - if point2 is in the exact opposite direction as point1, length will
    //     be negative, so be mindful of that.
        let length = [
            Math.hypot(...point1),
            Math.hypot(...point2)
        ];
        let multiplier = 1;
        let quat = Quat.new();
        if(length[0] && !length[1]) {
            multiplier = 0;
        }
        else if(length[0]) {
            multiplier = length[1]/length[0];
            if(Points.parallel(point1, point2)) {
            // it's either in the same direction, or an opposite direction.
                if(
                    Math.sign(point1[0]) === -Math.sign(point2[0])
                    &&
                    Math.sign(point1[1]) === -Math.sign(point2[1])
                    &&
                    Math.sign(point1[2]) === -Math.sign(point2[2])
                ) {
                // opposite direction
                    multiplier *= -1;
                };
            }
            else {
                quat = Quat.arc(Angle.get(...point1), Angle.get(...point2));
            }
        };
        return {multiplier, quat};
    },
    applychange: (point, multiplier, quat) => Quat.apply(quat, Points.multiply(point, multiplier)),
    applyfunc: function(point, code) {
        let _point = [];
        for(let i1 = 0; i1 < point.length; i1++) {
            _point[i1] = code(point[i1]);
        }
        return _point;
    },
    floor: (point) => Points.applyfunc(point, Math.floor),
    ceil: (point) => Points.applyfunc(point, Math.ceil),
    trunc: (point) => Points.applyfunc(point, Math.trunc),
};
class Viewer {
// a class for applying perspective.
// - ratio: how many pixels there are per degree.
// - x, y: the position of the vanishing point onscreen.
// - z: how far away the viewer is
// - disabled: obvious
    constructor(ratio, x, y, z, disabled) {
        this.ratio = typeof ratio === "number" ? ratio : .8;
        this.x = typeof x === "number" ? x : 0;
        this.y = typeof y === "number" ? y : 0;
        this.z = typeof z === "number" ? z : 0;
        this.disabled = !!disabled;
    }
    static fromobj(obj) {
        return (
            typeof obj === "object"
            ?
            new Viewer(obj.ratio ?? null, obj.x ?? null, obj.y ?? null, obj.z ?? null, obj.disabled ?? null)
            :
            new Viewer(null, null, null, null, true)
        );
    }
    convert(x, y, z) {
    // converts coordinates from x/y/z space to screen coordinates.
    // - NOTE: this returns three coordinates, since z is still used for knowing
    //   what's on top of what.
		if(this.disabled) {
			return [x, y, z];
		};
        for(let i1 = 0; i1 < 2; i1++) {
            let num = i1 ? y : x;
            let vp = this["xy"[i1]];
            //
            num = get2dangle(this.z - z, num - vp);
            if(num >= Math.PI) {
            // the range should be -PI to PI, not 0 to 2 PI. what we want to
            // know is how far away it is, and the direction.
                num -= 2*Math.PI;
            }
            num = num*(180/Math.PI)*this.ratio + vp;
    		// convert to degrees, use the ratio to convert to pixels, add the
    		// viewer x again
            //
            if(i1) {
                y = num;
            }
            else {
                x = num;
            }
        }
		return [x, y, z];
		// z isn't needed most of the time, it's just good for figuring out what
		// should be on top of what.
    }
    inverse(x, y, z, plane) {
    // inverse of .convert.
		if(this.disabled) {
			return plane.planepoint(x, y, "z");
		};
		// you can turn off perspective for something by not giving the
		// viewer.
		x -= this.x;
		y -= this.y;
		x /= (180/Math.PI)*this.ratio;
		y /= (180/Math.PI)*this.ratio;
		// get the screen x distance and y distance it has from the viewer, divide
		// by the degreeratio. this is what the xz angle or yz angle was. how many
		// degrees the viewer would have to turn to focus on the 3d coordinates
		// we're trying to get.
		if(x < 0) {
			x += 2*Math.PI;
		};
		if(y < 0) {
			y += 2*Math.PI;
		};
		// make sure they're within bounds.
		let line = null;
		if(typeof z === "number") {
			// x and y are still angles.
			// - x is Math.atan(-zdist/xdist), y is etc
			// - so tan(x) = -zdist/xdist, xdist = -zdist/tan(x)
			x = (this.z - z)/Math.tan(x);
			y = (this.z - z)/Math.tan(y);
			return [x + this.x, y + this.y, z];
		}
		else if(x === 0 && y === 0) {
			line = new Line(this.x, this.y, this.z, [0, -Math.PI/2]);
		}
		else {
			// need to figure out what x, y, and z distances should create these
			// angles.
			// -
			// need to get a 3d angle from two 2d angles...
			// - z/x = -xz_cos/xz_sin
			//   z/y = -yz_cos/yz_sin
			// - z = x*-xz_cos/xz_sin = y*-yz_cos/yz_sin
			line = [
				Math.sin(x)*-Math.cos(y),
				Math.sin(y)*-Math.cos(x),
				-Math.cos(x)*-Math.cos(y)
			];
			line = new Line(
				this.x,
				this.y,
				this.z,
				Angle.get(...line)
			);
			// z is negative because of how perspectiveconvert uses viewer.z - z, when
			// x and y are _ - viewer._
		};
		return line.planeintersect(plane);
    }
    z_size(z) {
    // how many pixels wide a sphere with a diameter of 1 would be if it's right
    // on the vanishing point and has the z you specified.
    // - used for scaling objects. like if you draw a bunch of circles that are
    //   supposed to represent spheres... the radius wouldn't be affected by
    //   perspective conversion, but it'd be wasteful to create a whole sphere
    //   of points when the little details aren't important.
		let dist = Math.abs(this.z - z);
		if(dist < 1) {
		// point is inside the circle
			return null;
		}
		let temp = Math.atan((1/4)/dist)*4;
		// - if you connect the viewer, the center of the sphere, and either
		//   tangent point, it forms an isosceles triangle.
		// - the diameter is 1, halve it so it's a radius, halve it again to
		//   make a right triangle. since we know both sides, it can be figured
		//   out with atan
		// - then multiply it by four to combine all four right triangles.
		temp *= 180/Math.PI;
		// convert to degrees
		temp *= this.ratio;
		// degrees * (pixels/degrees ratio) = pixels
		//
		// this is how many pixels wide a sphere with a diameter of 1 would be
		// if it's right on the vanishing point and has the z you specified.
		return temp;
	}
    get central_z() {
	// returns the viewer.z to use for a sphere to be sized the same as its true
    // dimensions.
    // - this.z_size(this.central_z) should equal 1.
		//let target = ((1/this.ratio)/360)*2*Math.PI;
		let target = (1/this.ratio)*Math.PI/180;
		// degrees per pixel, converted to radians. our calculations will
		// revolve around a sphere of 1 diameter, that's at 0 z. the amount of
		// radians it takes up in our vision has to equal its actual width, and
		// making the radians this target number will do that.
		if(target > Math.PI) {
			return null;
			// impossible. probably.
		};
		target /= 4;
		// divide the kite into two isosceles, divide the isosceles into two
		// right triangles. this is the angle of the corner pointed at the
		// viewer.
		return this.z - Math.abs(.25/Math.tan(target));
		// - the right triangle is like:
		//     C
		//    /|
		//   A-B
		// - which is the isosceles divided in half, remember. A represents the
		//   viewer, B is the sphere, C is the midpoint of the side between the
		//   tangent and the sphere's center.
		// - so side AB is viewer.z, side BC is half of the radius, (.25) and
		//   angle A is target/4. we get viewer.z if we figure out AB.
		// - the ratio between AB and BC should be the same as the ratio between
		//   cos and sin, aka 1/tan(target)
		// - AB/.25 = 1/tan
		// - AB = .25/tan
		// - but that represents how far z should be from viewer.z, not a z
		//   coordinate. add anim.viewer.z. (.25/tan is subtracted just because
		//   negative z means moving further away.)
	}
}
class Line {
// the Line class defines a line through 3d space by setting a point, and an
// angle. all points on the line are that angle from the point, or the
// inverse of that angle.
// - x, y, z: coordinates of the reference point on the line that stuff like
//   findplace is made from and .plane() intersects with
// - angle: an xy/z angle array
// - this is very closely related to the Plane class below. many of both
//   classes' functions revolve around the line/plane perpendicular to it.
    constructor(x, y, z, angle) {
        if(noargumentscheck([x, y, z, angle])) {
        // create an empty object that another object's contents can be
        // pasted into
            return;
        }
        this.x = x;
        this.y = y;
        this.z = z;
        this.angle = angle;
    }
    static frompoints(point1, point2) {
    // returns a new Line whose origin is point1 and passes through point2
        return new Line(...point1.slice(0, 3), Angle.get(
            point2[0] - point1[0],
            point2[1] - point1[1],
            point2[2] - point1[2]
        ));
    }
    plane() {
    // returns a new Plane that's perpendicular to this line. (the line's
    // coordinates are where the two intersect.)
        let x = Angle.numbers(this.angle);
        // if it's anything like 2d lines, the only difference between a
        // perpendicular plane that intersects with the line here and a
        // perpendicular plane that intersects there is the offset. Ax +
        // By + Cz + D = 0. you're changing D.)
        let y = x[1];
        let z = x[2];
        x = x[0];
        // the plane x:y:z ratio is probably equal to converting the angle
        // to numbers.
        let offset = -(x*this.x + y*this.y + z*this.z);
        // the line's point is supposed to be on this plane, so multiply the
        // coordinates by the plane modifiers. that + offset = 0, so -that =
        // offset.
        return new Plane(x, y, z, offset);
        // in a line, the coordinate proportions are always the same but
        // could total up to anything. in a plane, the coordinate
        // proportions could be anything but must always total up the same.
        // so yes, it is that easy.
    }
    linerevolve(angle, points) {
    // revolves a point or points around the Line.
    // - angle: this is the amount to revolve, not a 3d angle. a number from
    //   0 to 2 pi.
        return revolve(angle, points, [this.x, this.y, this.z], this.angle);
    }
    findposition(number) {
    // 0: the line's coordinates
    // 1: 1 unit away from the line's coordinates, in the direction defined
    // by the angle
    // -1: 1 unit away in the opposite direction
        if(!number) {
            return [this.x, this.y, this.z];
        };
        let anglenum = Angle.numbers(this.angle);
        return [
            this.x + anglenum[0]*number,
            this.y + anglenum[1]*number,
            this.z + anglenum[2]*number
        ];
    }
    planeintersect(plane, shush) {
    // returns the coordinates of a line/plane intersection.
        let point = [this.x, this.y, this.z];
        // a point where its distances from the Line's coordinate match the
        // ratio of the Line's angle numbers, and where the coordinates
        // the plane mods plus offset = 0.
        let total = point[0]*plane.x + point[1]*plane.y + point[2]*plane.z + plane.offset;
        // this is how far it is from x*x + y*y + z*z + offset equaling 0.
        if(total === 0) {
            return point;
        };
        let unit = Angle.numbers(this.angle);
        unit = unit[0]*plane.x + unit[1]*plane.y + unit[2]*plane.z;
        // this is how much moving one unit in the Line's angle will change
        // the total.
        if(unit === 0) {
            if(shush) {
                return "parallel";
            }
            else {
                console.log("this line will never intersect with the plane.");
                return;
            };
        };
        return this.findposition(-total/unit);
        // if you go enough units for the change to be the opposite of the
        // total, it will balance out to zero. donezo.
    }
    movetoline(point) {
    // moves the given point to a place on the line, using perpendicular
    // planes.
        if(!point) {
            point = [0, 0, 0];
        };
        return this.planeintersect(this.plane().parallel(point));
    }
    findplace(point) {
    // does an inverse of findposition, which works even if the point isn't
    // on the line.
        if(!Array.isArray(point)) {
            point = [0, 0, 0];
        };
        let place = this.plane().pointtotal( this.movetoline(point) );
        let sign = Math.sign(this.plane().pointtotal( this.findposition(1) ));
        return place*sign;
    }
    stretch_widen(point, stretch, widen) {
    // scales a point along the line. stretch multiplies its findplace,
    // widen multiplies its distance from the movetoline.
        let i1 = 0;
        stretch ??= 1;
        widen ??= 1;
        let _point = null;
        if(widen === 1) {
            _point = structuredClone(point)
        }
        else {
            let at_line = this.movetoline(point);
            _point = [];
            for(i1 = 0; i1 < 3; i1++) {
                _point[i1] = at_line[i1] + widen*(point[i1] - at_line[i1]);
            }
        }
        // subtract the distance from movetoline, multiply it, and add it
        // back
        if(stretch !== 1) {
            const anglenum = Angle.numbers(this.angle);
            const place = this.findplace(_point);
            for(i1 = 0; i1 < 3; i1++) {
                let temp = place*anglenum[i1];
                _point[i1] -= temp;
                _point[i1] += stretch*temp;
            }
        }
        // subtract anglenum, multiply it, add it back
        return _point;
    }
}
class Plane {
// class for defining a 2d plane in 3d space through a modifier for each
// axis, and an offset. points are on the plane if multiplying each
// coordinate by the plane's modifier and adding the plane's offset equals
// 0.
    constructor(x, y, z, offset) {
        if(noargumentscheck([x, y, z, offset])) {
        // create an empty object that another object's contents can be
        // pasted into
            return;
        }
        this.x = x;
        this.y = y;
        this.z = z;
        this.offset = offset;
    }
    origin() {
    // returns the point closest to [0, 0, 0].
        if(this.offset) {
            let i1 = 0;
            let axis = 0;
            let axis_value = this.x;
            for(i1 = 1; i1 < 3; i1++) {
                let value = this["xyz"[i1]];
                if(Math.abs(value) > Math.abs(axis_value)) {
                    axis = i1;
                    axis_value = value;
                }
            }
            if(axis_value) {
                let origin = [0, 0, 0];
                origin[axis] = -this.offset/axis_value;
                return origin;
            }
            else {
                console.log("this shouldn't happen");
                // only possible with 0, 0, 0 for x/y/z, which would cover
                // nothing at all (or everything if offset was 0)
                return;
            }
        }
        else {
            return [0, 0, 0];
        }
    }
    line(coord1, coord2, missingaxis, shush) {
    // returns a new Line that's perpendicular to this plane and intersects
    // at the point specified.
    // - uses planepoint.
        let point = (
            noargumentscheck(coord1, coord2, missingaxis, shush)
            ?
            this.origin()
            :
            this.planepoint(coord1, coord2, missingaxis, shush)
        );
        return new Line(point[0], point[1], point[2], Angle.get(this.x, this.y, this.z));
    }
    planepoint(coord1, coord2, missingaxis, shush) {
    // enter two coordinates and a missing axis, it'll fill the third with
    // whatever would be on the plane.
        if(typeof coord1 !== "number" || typeof coord2 !== "number" || !["x", "y", "z"].includes(missingaxis)) {
            if(this.offset === 0) {
                return [0, 0, 0];
            };
            let output = this.planepoint(0, 0, "z", true);
            if(typeof output !== "string") {
                return output;
            }
            output = this.planepoint(0, 0, "y", true);
            if(typeof output !== "string") {
                return output;
            }
            output = this.planepoint(0, 0, "x", true);
            if(typeof output !== "string") {
                return output;
            }
            else if(shush) {
                return "error";
            }
            else {
                console.log("this shouldn't happen: " + output);
                return;
            }
        }
        if(this[missingaxis] === 0) {
        // later on something will be divided by this.
            if(shush) {
                return "parallel";
            }
            else {
                console.log("these coordinates are parallel to the plane.");
                return;
            }
        };
        let total = this.offset;
        if(missingaxis === "x") {
            total += this.y*coord1;
            total += this.z*coord2;
        }
        else if(missingaxis === "y") {
            total += this.x*coord1;
            total += this.z*coord2;
        }
        else if(missingaxis === "z") {
            total += this.x*coord1;
            total += this.y*coord2;
        }
        else if(shush) {
            return "invalid input";
        }
        else {
            console.log("this shouldn't happen");
            return;
        };
        // total + missingaxisnum*missingaxismod = 0
        // so missingaxisnum = -total/missingaxismod
        let coord3 = -total/this[missingaxis];
        if(missingaxis === "x") {
            return [coord3, coord1, coord2];
        }
        else if(missingaxis === "y") {
            return [coord1, coord3, coord2];
        }
        else if(missingaxis === "z") {
            return [coord1, coord2, coord3];
        };
    }
    parallel(point) {
    // enter a point, and it'll return a plane parallel to this one that
    // that point is on.
        return new Plane(this.x, this.y, this.z, -(this.x*point[0] + this.y*point[1] + this.z*point[2]));
    }
    static frompoints(points/*[[x, y, z], [x, y, z], [x, y, z]]*/) {
    // creates a plane from the three points specified.
        let dA = {
            x: points[1][0] - points[0][0],
            y: points[1][1] - points[0][1],
            z: points[1][2] - points[0][2],
        };
        // distances from point 0 to point 1
        let dB = {
            x: points[2][0] - points[0][0],
            y: points[2][1] - points[0][1],
            z: points[2][2] - points[0][2],
        };
        // distances from point 0 to point 2
        let temp = [
            Angle.get(dA.x, dA.y, dA.z),
            Angle.get(dB.x, dB.y, dB.z)
        ];
        if(
            !temp[0] || !temp[1]
            ||
            (
                temp[0][0] === temp[1][0]
                &&
                temp[0][1] === temp[1][1]
            )
            ||
            (
                temp[0][0] === -temp[1][0]
                &&
                temp[0][1] === -temp[1][1]
            )
        ) {
        // if any of the points are the same or if they all fall on the same
        // line, you can't create a valid plane.
            return null;
        };
        let xmod = (dA.y * dB.z) - (dA.z * dB.y);
        let ymod = (dA.z * dB.x) - (dA.x * dB.z);
        let zmod = (dA.x * dB.y) - (dA.y * dB.x);
        // cross product of the two vectors
        // - ie this makes a line that's perpendicular to the 0-1 and 0-2
        //   lines, and using angle numbers as plane numbers creates a plane
        //   perpendicular to that line.
        let offset = -(xmod*points[0][0] + ymod*points[0][1] + zmod*points[0][2]);
        // the equation in standard form is
        // xmod*x + ymod*y + zmod*z + offset = 0
        return new Plane(xmod, ymod, zmod, offset);
    }
    pointtotal(point) {
    // returns the point times the modifiers plus offset.
    // - possible uses:
    //   - knowing which side of the plane a point is on (like for using a
    //     plane as a cutoff area)
    //   - knowing if a point is on the plane (though, i recommend adding
    //     like .00001 leeway or something)
    //   - simplifying logic, in general
        return this.x*point[0] + this.y*point[1] + this.z*point[2] + this.offset;
    }
    linesegmentintersect(point1, point2, avoidequal) {
    // returns a coordinate, or null if they don't intersect.
    // - avoidequal: makes it return null if the intersection is on one of
    //   the points instead of being between them.
        let line = new Line(
            point1[0],
            point1[1],
            point1[2],
            Angle.get(
                point2[0] - point1[0],
                point2[1] - point1[1],
                point2[2] - point1[2]
            )
        );
        let intersect = line.planeintersect(this, true);
        if(
            typeof intersect === "string"
            ||
            intersect[0] < Math.min(point1[0], point2[0])
            ||
            intersect[0] > Math.max(point1[0], point2[0])
            ||
            intersect[1] < Math.min(point1[1], point2[1])
            ||
            intersect[1] > Math.max(point1[1], point2[1])
            ||
            intersect[2] < Math.min(point1[2], point2[2])
            ||
            intersect[2] > Math.max(point1[2], point2[2])
            ||
            (
                avoidequal
                &&
                (
                    compareobject(intersect, point1)
                    ||
                    compareobject(intersect, point2)
                )
            )
        ) {
            return null;
        }
        else {
            return intersect;
        }
    }
    static tricutoff(planes, signproperty, points) {
    // returns a new form of the shape specified that has been subject to
    // the cutoffs. (useful for 3d graphics.)
    // - planes: an array or object of planes for it to run the shape
    //   through.
    // - signproperty: which property to check to find the sign a point's
    //   .pointtotal has to be in order for it to be cutoff (in other words,
    //   should it be the side where coordinates times plane mods plus
    //   offset are *more* than 0, or less?)
    //   - if a point's .pointtotal's Math.sign matches the
    //     plane[signproperty], it's cutoff.
    // - points: a series of points that form a shape. works like
    //   _2dPoly.draw, it's assumed they're connected into a closed shape.
    //   - unless there's only one or two points.
        let i1 = 0;
        let i2 = 0;
        signproperty = (signproperty ? signproperty : "cutoff");
        let cutoff = [];
        // an array of booleans that matches the points array, for which
        // points are past the cutoff. cleared with every new plane
        let intersect = [];
        // same thing, for storing whether a point's connection to the next
        // point intersects with the plane.
        if(points.length >= 3) {
        // triangles and stuff
            let newshape = [];
            // a new array of points that replaces points
            for (i1 in planes) {
                if (planes.hasOwnProperty(i1)) {
                    cutoff = [];
                    intersect = [];
                    for (i2 = 0; i2 < points.length; i2++) {
                        // identify intersections and cutoff points
                        intersect[i2] = planes[i1].linesegmentintersect(points[i2], points[(i2 + 1)%points.length], true);
                        cutoff[i2] = Math.sign(planes[i1].pointtotal(points[i2])) === planes[i1][signproperty];
                    }
                    newshape = [];
                    for (i2 = 0; i2 < points.length; i2++) {
                        // creates the new version of points
                        if(!cutoff[i2]) {
                            newshape[newshape.length] = structuredClone(points[i2]);
                        };
                        if(intersect[i2]) {
                            newshape[newshape.length] = structuredClone(intersect[i2]);
                        };
                    }
                    if(compareobject(newshape, [])) {
                        return newshape;
                    }
                    else {
                        points = structuredClone(newshape);
                    }
                }
            }
            return points;
        }
        else if(points.length === 2) {
        // a single line
            for (i1 in planes) {
                if (planes.hasOwnProperty(i1)) {
                    cutoff = [
                        Math.sign(planes[i1].pointtotal(points[0])) === planes[i1][signproperty],
                        Math.sign(planes[i1].pointtotal(points[1])) === planes[i1][signproperty]
                    ];
                    intersect = planes[i1].linesegmentintersect(points[0], points[1], true);
                    if(cutoff[0] && cutoff[1]) {
                    // both are removed
                        return [];
                    }
                    else if(!cutoff[0] && !cutoff[1]) {
                    // both are retained
                    }
                    else if(cutoff[0]) {
                        points = [
                            structuredClone(intersect),
                            structuredClone(points[1]),
                        ];
                    }
                    else if(cutoff[1]) {
                        points = [
                            structuredClone(points[0]),
                            structuredClone(intersect),
                        ];
                    }
                    else {
                        console.log("this shouldn't happen");
                    };
                }
            }
            return points;
        }
        else if(points.length === 1) {
        // a single point
            for (i1 in planes) {
                if (planes.hasOwnProperty(i1) && Math.sign(planes[i1].pointtotal(points[i2])) === planes[i1][signproperty]) {
                    return [];
                }
            }
            return points;
        }
        else if(points.length === 0) {
            return points;
        }
    }
    movetoplane(point) {
        let i1 = 0;
        let pointtotal = this.pointtotal(point);
        let _return = structuredClone(point);
        let anglenum = Angle.get(this.x, this.y, this.z);
        anglenum = Angle.numbers(anglenum);
        for (i1 = 0; i1 < 3; i1++) {
            _return[i1] += -pointtotal*anglenum[i1];
            // pointtotal is how many anglenums it's past the plane, so if
            // you subtract that many...
        }
        return _return;
    }
}
let Angle = {
// a pseudo-class object where i store methods related to angles.
// - angles are an xy angle, (between 0 and 2 pi) a z angle, (between -pi/2
//   and pi/2) and roll. (between 0 and 2 pi)
// - the z angle is a measure of how much it's rotated towards the z poles.
//   - it's similar to azimuth and altitude.
//   - i think it might've been based on latitude/longitude?
// - for now it just uses the old versions.
// - this was gonna be a class, but... nah. it's really annoying to have the
//   old array format and new object format coexist, and you gotta worry
//   about classes getting lost in JSON.stringify/JSON.parse cycles too.
//   it's more trouble than it's worth, the only reason i wanted a class was
//   because the names/syntax of my global functions sucked.
// - relative angles
    get: function(x, y, z, shush) {
        if(typeof x !== "number" || typeof y !== "number" || typeof z !== "number" || isNaN(x) || isNaN(y) || isNaN(z)) {
            if(shush) {
                return null;
            }
            else {
                console.log("invalid Angle.get input.");
                console.log([x, y, z]);
                return [0, 0];
            };
        }
        let angle = [
            get2dangle(x, y, true),
            get2dangle(Math.hypot(x, y), z, true),
        ];
        if(typeof angle[0] !== "number") {
        // happens if x and y are zero
            angle[0] = 0;
        };
        if(typeof angle[1] !== "number") {
        // happens if all three are zero
            if(shush) {
                return null;
            }
            else {
                console.log("Angle.get: " + (x === 0 && y === 0 && z === 0 ? "all three coordinates are zero." : "unknown error."));
                return [0, 0];
            };
        };
        // this makes sure xy is between 0 and 2 pi, and x is between
        // -1/2 pi and 1/2 pi
        //angle[2] = 0;
        return Angle.correct(angle);
    },
    getwithroll: function(numsatel) {
    // this interprets your input as an array of two points: an angle
    // numbers and a roll satellite. it returns an angle with roll.
        let angle = Angle.get(...numsatel[0]);
        angle[2] = [
            numsatel[1][0] - numsatel[0][0],
            numsatel[1][1] - numsatel[0][1],
            numsatel[1][2] - numsatel[0][2],
        ];
        angle[2] = Angle.get(...angle[2]);
        angle[2] = rollinverse(angle, angle[2]);
        return angle;
    },
    numbers: function(_this, satellite) {
    // gives numbers equivalent to cos and sin, but for 3d. numbers between
    // -1 and 1, that represent where a point on a sphere of 1 radius would
    // be.
    // - satellite: if true, this will return two points, one of them being
    //   the angle numbers of the rolldirection plus the original angle
    //   numbers
        if(satellite) {
            let points = [];
            points[0] = Angle.numbers(_this);
            points[1] = Angle.numbers(rolldirection(_this));
            points[1][0] += points[0][0];
            points[1][1] += points[0][1];
            points[1][2] += points[0][2];
            return points;
        }
        else {
            return [
                Math.cos(_this[0])*Math.cos(_this[1]),
                Math.sin(_this[0])*Math.cos(_this[1]),
                Math.sin(_this[1])
            ];
        }
    },
    correct: function(_this) {
    // corrects it if it's out of bounds, like if you just added two angles
    // together.
        let i1 = 0;
        let angle = structuredClone(_this);
        angle[0] = posmod(angle[0], 2*Math.PI);
        // make sure xy angle is a positive number
        angle[1] = Math.sign(angle[1])*posmod(Math.abs(angle[1]), 2*Math.PI);
        // z is now between -2 pi and 2 pi.
        if(angle[2] || angle[2] === 0) {
            angle[2] = posmod(angle[2], 2*Math.PI);
        }
        for (i1 = 0; i1 < 4; i1++) {
        // but it should be between -pi/2 and pi/2.
            if(
                Math.abs(angle[1]) >= i1*Math.PI/2
                &&
                Math.abs(angle[1]) < (i1 + 1)*Math.PI/2
            ) {
                if(i1 === 0 || Math.abs(angle[1]) === Math.PI/2) {
                // if it's -90 to 90, skip it.
                }
                else if([1, 2].includes(i1)) {
                    angle[0] = posmod(angle[0] + Math.PI, 2*Math.PI);
                    angle[1] = Math.sign(angle[1])*(Math.PI - Math.abs(angle[1]));
                    // it should flip around to the other side, but stay
                    // in the same z hemisphere if it's less than 180.
                }
                else if(i1 === 3) {
                    angle[1] = -Math.sign(angle[1])*(2*Math.PI - Math.abs(angle[1]));
                    // it should flip around to the other z hemisphere.
                }
                i1 += 4;
                // exit
            }
        }
        return angle;
    },
    invert: function(_this, includeroll) {
    // creates an angle that points in the opposite direction.
        if(typeof _this === "number") {
            return posmod(_this + Math.PI, 2*Math.PI);
        };
        let angle = [
            posmod(_this[0] + Math.PI, 2*Math.PI),
            -_this[1]
        ];
        if(_this[2] || _this[2] === 0) {
            angle[2] = (includeroll ? posmod(_this[2] + Math.PI, 2*Math.PI) : _this[2]);
        }
        else if(includeroll) {
            angle[2] = Math.PI;
        };
        return angle;
    },
    compare: function(_this, angle2) {
    // gives the 2d angle between this and the angle specified.
        let angle1 = _this;
        let sides = [
            Angle.numbers(angle1),
            Angle.numbers(angle2)
        ];
        sides = {
            a: Math.hypot(
                sides[0][0] - sides[1][0],
                sides[0][1] - sides[1][1],
                sides[0][2] - sides[1][2]
            ),
            b: 1,
            c: 1,
            // technically those two should be hypotenuses of angle numbers,
            // but those are always supposed to be 1.
        };
        // A = Math.acos((-a2 + b2 + c2)/(2*b*c))
        let _return = -(sides.a**2) + sides.b**2 + sides.c**2
        _return /= 2*sides.b*sides.c;
        if(Math.abs(_return) > 1) {
        // acos inputs need to be within -1 and 1, but sometimes rounding
        // errors can make it -1.0000000000000009 or something.
            let temp = Math.abs(_return) - 1;
            if(temp > .0000000001) {
                logspecial({angle1, angle2}, "Angle.compare: invalid acos input: " + _return, true);
                console.log(`posmod(Math.acos(` + (-(sides.a**2) + sides.b**2 + sides.c**2)/(2*sides.b*sides.c) + `), 2*Math.PI);`);
                console.log(`posmod(` + Math.acos((-(sides.a**2) + sides.b**2 + sides.c**2)/(2*sides.b*sides.c)) + `, 2*Math.PI);`);
            }
            else {
                _return = Math.min(_return, 1);
                _return = Math.max(_return, -1);
            };
        };
        _return = posmod(Math.acos(_return), 2*Math.PI);
        return _return;
        // law of cosine: a2 = b2 + c2 - 2*b*c*cos(A)
        // 2*b*c*cos(A) = -a2 + b2 + c2
        // cos(A) = (-a2 + b2 + c2)/(2*b*c)
        // A = Math.acos((-a2 + b2 + c2)/(2*b*c))
        // - (angles are opposite of their associated sides)
        // - we know all three coordinates, so we can get all three side
        //   lengths.
        //   - A is the point/angle at the origin.
        //   - B is the point/angle at angle1's angle numbers
        //   - C is the point/angle at angle2's angle numbers
        //   - b is the side connecting the origin to angle2
        //   - c is the side connecting the origin to angle1
        //return Math.hypot(angle2[0] - angle1[0], angle2[1] - angle1[1]);
        // - i originally just used the hypotenuse of the xy difference and
        //   the z difference, but that doesn't work well. it's probably
        //   related to the fact that the size of the xy arc is modified by
        //   the cosine of the z angle. i could maybe maybe math that out
        //   with trial and error but guess what's easier and more reliable
    },
    rand: function(includeroll) {
    // constructs a random angle.
        let angle = [
            Math.random()*2*Math.PI,
            (Math.random() - .5)*Math.PI
        ];
        if(includeroll) {
            angle[2] = Math.random()*2*Math.PI;
        };
        return angle;
    },
    linerevolve: function(_this, points, center) {
    // uses roll as the amount to revolve by.
        return revolve(0, points, center, objecttoarray(_this));
    },
    orient: function(_this, points, center) {
    // how 3d shape orientation works is, plot an angle numbers and
    // satellite, revolve those for every revolve applied to the shape, and
    // convert it back to a number to get an absolute angle you can use to
    // recreate that orientation. this applies that orientation.
        let _points = revolve([_this[0], _this[1]], structuredClone(points), center);
        return revolve(_this[2] ?? 0, _points, center, [_this[0], _this[1]]);
    },
    convert: function(_this, to, from) {
    // convert from radians, degrees, or circumferences to another one of
    // those things. (only type the first three letters.)
    // - this can be used on 2d angles too. the only requirement is that
    //   it's a number or an object with nothing but number properties.
    // - you can also use numbers instead of strings. (use whatever number
    //   the equivalent of 360 is. 1 would work the same as "cir".)
    // - if to is "rad" and from is invalid/absent, it'll convert degrees to
    //   radians
        let angle = structuredClone(_this);
        let divisor = {
            rad: 2*Math.PI,
            deg: 360,
            cir: 1,
        };
        function numberize(format) {
            if(typeof format === "number") {
            }
            else if(divisor.hasOwnProperty(format)) {
                return divisor[format];
            }
            else {
                return "invalid";
            };
        }
        to = numberize(to);
        from = numberize(from);
        if(to === "invalid") {
            to = divisor.deg;
        }
        if(from === "invalid") {
            from = to === divisor.rad ? divisor.deg : divisor.rad;
        }
        // if neither is filled, it assumes you're converting radians to
        // degrees. if to is degrees and from is invalid, it assumes you're
        // converting degrees to radians.
        if(typeof angle === "object") {
            let i1 = "";
            for (i1 in angle) {
                if (angle.hasOwnProperty(i1) && typeof angle[i1] === "number") {
                    angle[i1] *= to/from;
                }
            }
        }
        else if(typeof angle === "number") {
            angle *= to/from;
        }
        else {
            console.log("this shouldn't happen")
        }
        return angle;
    },
    between: function(angle1, angle2, place) {
    // if place = 0, it'll return angle1. if place = 1, it'll return angle2.
        let quat = Quat.arc(angle1, angle2);
        if(quat === null) {
        // angles are parallel.
            return null;
        }
        quat = Quat.multiply_num(quat, place);
        return Angle.get(...Quat.apply(quat, Angle.numbers(angle1)));
    },
};
let Quat = {
// quaternion pseudoclass. don't bother looking too hard into this,
// quaternions are super fucked up!
// - do you have any idea how long it took to find good resources for this?
//   - check out the 3Blue1Brown youtube channel and the multiplication
//     table at the top of the quaternion wikipedia page. it's pretty hard
//     to figure out even then.
    new: function(axis, magnitude, inverse) {
    // create from a line revolve
    // - inverse: applies the inverse of the given Quat to the axis angle
    //   numbers. used mostly in rotate/local_rotate.
        if(Array.isArray(axis)) {
            magnitude += axis[2] ?? 0;
        };
        // add roll
        let num = (
            axis === "yz" ? [1, 0, 0] :
            axis === "xz" ? [0, -1, 0] :
            axis === "xy" ? [0, 0, 1] :
            !axis ? [0, 0, 0] :
            Angle.numbers(axis)
        );
        if(inverse) {
            num = Quat.apply(Quat.invert(inverse), num);
        };
        magnitude ??= 0;
        magnitude = [
            Math.cos(magnitude/2),
            Math.sin(magnitude/2)
        ];
        return {
            w: magnitude[0],
            x: magnitude[1]*num[0],
            y: magnitude[1]*num[1],
            z: magnitude[1]*num[2],
        };
    },
    arc: function(angle1, angle2) {
    // quaternion for the shortest arc between the two angles. returns null if
    // the angles are parallel.
        let v1 = Angle.numbers(angle1);
        let v2 = Angle.numbers(angle2);
        if(Points.parallel(v1, v2)) {
            return null;
        };
        let cross = Points.cross(v1, v2);
        let quat = Points.apply(cross, Quat.new());
        quat.w = Math.hypot(...v1)*Math.hypot(...v2) + Points.dot(v1, v2);
        return Quat.normalized(quat);
    },
    local_multiply: function(_this, quat) {
    // apply another quaternion to this one. NOTE: quaternion multiplication
    // changes based on how they're ordered.
        const x = _this.x;
        const y = _this.y;
        const z = _this.z;
        const w = _this.w;
        const _x = quat.x;
        const _y = quat.y;
        const _z = quat.z;
        const _w = quat.w;
        return {
            w: w*_w - (x*_x + y*_y + z*_z),
            x: w*_x + x*_w + y*_z - z*_y,
            y: w*_y + y*_w + z*_x - x*_z,
            z: w*_z + z*_w + x*_y - y*_x,
        };
    },
    multiply: (_this, quat) => Quat.local_multiply(_this, Quat.local_multiply(quat, Quat.invert(_this))),
    local_rotate: (_this, axis, magnitude) => Quat.local_multiply(_this, Quat.new(axis, magnitude)),
    rotate: (_this, axis, magnitude) => Quat.local_multiply(_this, Quat.new(axis, magnitude, _this)),
    // rotate quaternion by a line revolve
    // - NOTE: the difference between "local" and nonlocal multiply/rotate
    //   is that local interprets the axis as being relative to the
    //   quaternion.
    //   - what that means is, [0, 0] won't rotate the quaternion around the
    //     absolute x axis, it'll rotate it around whatever angle [1, 0, 0]
    //     would be translated to, as the quaternion is right now. rotate
    //     avoids this.
    //   - however, the local version is more... i don't know, "pure"? when
    //     math stuff talks about multiplying, chances are it expects the
    //     local version. the nonlocal versions are modified versions, where
    //     the first quaternion's influence is reverted.
    invert: function(_this) {
        return {
            w: _this.w,
            x: -_this.x,
            y: -_this.y,
            z: -_this.z,
        };
    },
    apply: function(_this, point) {
    // figure out where a point should be after being oriented through this
    // quaternion.
    // - NOTE: use orient if you have multiple points.
        let temp = Quat.local_multiply(_this, {
            w: 0,
            x: point[0],
            y: point[1],
            z: point[2],
        });
        temp = Quat.local_multiply(temp, Quat.invert(_this));
        return [
            temp.x,
            temp.y,
            temp.z
        ];
    },
    basis: function(_this) {
        return [
            Quat.apply(_this, [1, 0, 0]),
            Quat.apply(_this, [0, 1, 0]),
            Quat.apply(_this, [0, 0, 1])
        ];
    },
    // creates a basis, a set of three three-coordinate points representing
    // how much x/y/z a unit of x, y, or z should translate to.
    orient: function(_this, points) {
    // apply the quaternion to multiple points at once. (for example,
    // orienting a 3d shape)
        let i1 = 0;
        let i2 = 0;
        let basis = Quat.basis(_this);
        let _points = [];
        for(i1 = 0; i1 < points.length; i1++) {
            _points[i1] = apply_basis(basis, points[i1]);
        }
        return _points;
    },
    length: (_this) => Math.hypot(_this.w, _this.x, _this.y, _this.z),
    normalized: function(_this) {
        let length = Quat.length(_this);
        return {
            w: _this.w/length,
            x: _this.x/length,
            y: _this.y/length,
            z: _this.z/length,
        };
    },
    magnitude: (_this) => 2*Math.acos(_this.w),
    axis: (_this) => Quat.axis_magnitude(_this).axis,
    axis_magnitude: function(_this) {
        let magnitude = Quat.magnitude(_this);
        let axis = Math.sin(magnitude);
        if(axis && _this.x && _this.y && _this.z) {
            axis = Angle.get(
                _this.x/axis,
                _this.y/axis,
                _this.z/axis
            );
        }
        else {
            axis = null;
        };
        return {axis, magnitude};
    },
    multiply_num: function(_this, num) {
    // multiplies the magnitude by the number you specify. (w and magnitude
    // aren't quite correlative.)
        let temp = Quat.axis_magnitude(_this);
        return Quat.new(temp.axis, temp.magnitude*num);
    },
    string: (_this) => [
        "w: " + _this.w,
        "x: " + _this.x,
        "y: " + _this.y,
        "z: " + _this.z
    ].join("\n"),
    valid: (_this) => (
        typeof _this === "object"
        &&
        typeof _this.w === "number"
        &&
        typeof _this.x === "number"
        &&
        typeof _this.y === "number"
        &&
        typeof _this.z === "number"
    ),
    dot: (quat1, quat2) => quat1.w*quat2.w + quat1.x*quat2.x + quat1.y*quat2.y + quat1.z*quat2.z,
    slerp: function(quat1, quat2, num) {
    // 0 makes something like quat1, 1 makes something like quat2.
        let dot = Quat.dot(quat1, quat2);
        let quat = structuredClone(dot < 0 ? Quat.invert(quat2) : quat2);
        dot = Math.abs(dot);
        let scale1 = 1 - num;
        let scale2 = num;
        if(1 - dot > 0) {
            let temp1 = Math.acos(dot);
            let temp2 = Math.sin(temp1);
            scale1 = Math.sin(scale1*temp1)/temp2;
            scale2 = Math.sin(scale2*temp1)/temp2;
        };
        return {
            w: scale1*quat1.w + scale2*quat.w,
            x: scale1*quat1.x + scale2*quat.x,
            y: scale1*quat1.y + scale2*quat.y,
            z: scale1*quat1.z + scale2*quat.z,
        };
    },
};

class Rect {
// not sure if i'll use this, but.
    constructor(x, y, w, h) {
        this.x = typeof x === "number" ? x : 0;
        this.y = typeof y === "number" ? y : 0;
        this.w = typeof w === "number" ? w : 0;
        this.h = typeof h === "number" ? h : 0;
    }
    get l() {
        return Math.min(this.x, this.x + this.w);
    }
    get r() {
        return Math.max(this.x, this.x + this.w);
    }
    get u() {
        return Math.min(this.y, this.y + this.h);
    }
    get d() {
        return Math.max(this.y, this.y + this.h);
    }
    setedge(edge, value) {
        if(typeof edge === "string" && "lrud".includes(edge) && edge.length === 1 && typeof value === "number") {
            let num = "lrud".indexOf(edge);
            let edge = this[edge];
            let other = this["rldu"[num]];
            let axis = Math.floor(edge/2);
            this["xy"[axis]] += value - edge;
            this["wh"[axis]] = Math.abs(value - other) * (this["wh"[axis]] < 0 ? -1 : 1);
        }
    }
    set l(value) {
        this.setedge("l", value);
    }
    set r(value) {
        this.setedge("r", value);
    }
    set u(value) {
        this.setedge("u", value);
    }
    set d(value) {
        this.setedge("d", value);
    }
}
//
function diamondsquare(context, x, y, size, modfunc, drawfunc) {
/*
diamondsquare(ctx, x, y, size, (input, level) => input*(1 - 1/variation + Math.random()*2/variation), function(ctx, x, y, value) {
    ctx.fillStyle = "rgb(" + value + ", " + value + ", " + value + ")";
    ctx.fillRect(x, y, 1, 1);
});
bg.ds_data = diamondsquare(false, 0, 0, 256, (input, level) => input + 32*randexponent(1, true)*( ( 2**(-1) )**(Math.log2(64) - level) ) + 4*randexponent(1, true));
// - this is the one i'm using for my website
// - the 32*randexponent(1, true)*( ( 2**(-1) )**(Math.log2(64) - level) )
//   is, i think, standard fare
//   - none of my sources have very clear wording to be honest
/    - but you're supposed to add a random value, and every step that should
//     be multiplied by 2**x (x being a number between -1 and 0 set by the
//     user, it controls the roughness of the terrain)
// - 4*randexponent(1, true) is to recreate something from my older crappier
//   algorithm. in that algorithm, the 0, 128, and 256 coordinates were
//   always noticeable, usually the highest or lowest values are near them
//   which looks really bad. but. the fact that is was more random at a
//   finer level made the terrain really rough, waves of color cycling
//   always looked kinda garbly and spray-painty.
if(currframe === 0) {
    var ds_data = diamondsquare(false, 0, 0, 256, (input, level) => input + 64*randexponent(1, true)*( ( 2**(-1) )**(Math.log2(64) - level) ));
    var ds_temp = 0;
};
for (i1 = 0; i1 < ds_data.length; i1++) {
    for (i2 = 0; i2 < ds_data[i1].length; i2++) {
        ds_temp = Math.floor(ds_data[i1][i2] + 256*currframe/numofframes)%256;
        if(ds_temp < 16) {
            ctx.fillStyle = "white";
        }
        else {
            ctx.fillStyle = "black";
        };
        ctx.fillRect(i1, i2, 1, 1);
    }
}
// - basic code for testing it.
//*/
// draws the diamond-square thing.
// - be warned: it will increase the size number to whatever is the next 2
//   exponent and clear anything that's in the way of that.
// - also, it will create a texture that loops.
// - i'm confident i wrote this a thousand times better than last time and
//   in half the time, but it still just cannot handle it... it draws just
//   fine, but anything bigger than 32x32 and it'll take so damn long, if it
//   ever finishes.
//   - i've heard javascript compiles in real time, unlike other languages.
//     i only know javascript so i don't even have an idea of what they
//     mean, but... maybe the trouble comes from it having to do this way
//     faster than it should have to.
//   - maybe there's ways i could speed it up?
//     - namely, keeping all the colors of the previous diamond/square steps
//       in an array and figuring out some fancy math that finds the right
//       index... it wouldn't be so hard.
//       - make an old colors array and new colors array
//       - before every pair of diamond/square steps, new becomes the old
//       - the array structure is:
//         - x (columns)
//           - y (rows)
//             - r, g, b, a
//       - of course, instead of using positions, it counts how many
//         half-increments down/right it is
//       - so when the diamond step reaches for the top right neighbor, it
//         looks for new x index/2 + 1/2 for the x index and new y/2 - 1/2
//         for y,
//       - nope, this wouldn't work. it needs to be able to reference every
//         pixel, not just pixels from the previous step.
//     - the primary goal is to make what it does on every pixel much more
//       concise.
//     - or i could create an ImageData? i theorized before that maybe
//       fillRect isn't meant to apply pixel by pixel changes.
//       - ideally, it should only make it into an imageData at the end.
//         that way this can be used for other things, like morphing 3d
//         shapes
//     - i should also cut out redundant logic regarding checking red,
//       green, blue AND alpha. making it change colors in weirder ways is
//       for after it's done.
//       - simplified it. i think it helped a bit.
//   - i don't get why creating and drawing entire 3d body models is less
//     taxing than this. but i guess ds_getvalue *does* have to run 1024
//     times.
//   - anyway, the only thing i didn't do was make an ImageData array. it's
//     still slow as fuck.
//   - or not? i don't remember changing anything, but it can work way
//     faster now, and at any size
// - modfunc:
//   - either it is a function with the arguments "input" and "level"
//     - input is the original number
//     - the distance between the numbers it's setting is always an exponent
//       of 2, level is what exponent that is. 1 is 0, 2 is 1, 4 is 2, 8 is
//       3, 16 is 4, etc
//   - or it's a fraction that it multiplies by 256 and adds or subtracts
//     from the value
//     - as in 1/4 makes it add something between -64 and 64
// - drawfunc: a function run on every pixel to set the color and draw it.
//   by default, it's single pixels in shades of gray.
//   - it should be a function with four arguments, ctx, x, y, value.
//   - if it's just a string that says "getvalues", it won't draw anything,
//     and diamondsquare will instead return the values array at the end.
// - giving a falsy context will do the same thing as "getvalues".
    //let context = this;
    let i1 = 0;
    let i2 = 0;
    function ds_getvalue(size, modfunc, xindex, yindex, increment, step, values) {
        let setvalue = 0;
        let postemp = [];
        for(let i1 = 0; i1 < 4; i1++) {
            if(step === "diamond") {
                postemp = [
                    (i1%2 === 0 ? -increment/2 : increment/2),
                    (i1%4 < 2 ? -increment/2 : increment/2),
                ];
            }
            else if(step === "square") {
                postemp = [0, 0];
                switch (i1) {
                    case 0:
                    postemp[1] = -increment/2;
                    break;
                    case 1:
                    postemp[0] = increment/2;
                    break;
                    case 2:
                    postemp[1] = increment/2;
                    break;
                    case 3:
                    postemp[0] = -increment/2;
                    break;
                }
            }
            else {
                console.log("oops");
                loopexit = true;
                return;
            };
            postemp[0] += xindex;
            postemp[0] = posmod(postemp[0], size);
            postemp[1] += yindex;
            postemp[1] = posmod(postemp[1], size);
            setvalue += values[postemp[0]][postemp[1]];
        }
        setvalue /= 4;
        // now it's an average of the other values
        if(typeof modfunc === "number") {
            setvalue += Math.floor((Math.random()*2*modfunc - modfunc)*256);
            // adds between -modfunc*256 and modfunc*256
        }
        else {
            setvalue = modfunc(setvalue, Math.log2(increment));
        }
        setvalue = Math.max(setvalue, 0);
        setvalue = Math.min(setvalue, 255);
        return setvalue;
    }
    function ds_draw(value, x, y) {
        if(!context || drawfunc === "getvalues") {
        }
        else if(!drawfunc) {
            context.fillStyle = "rgb(" + value + ", " + value + ", " + value + ")";
            context.fillRect(x, y, 1, 1);
        }
        else {
            drawfunc(context, x, y, value);
        };
    }
    if(!modfunc || !["function", "number"].includes(typeof modfunc)) {
        modfunc = 1/4;
    };
    for(i1 = 0; 2**i1 < size; i1++) {
    }
    size = 2**i1;
    // the width and height of the effect
    if(context && drawfunc !== "getvalues") {
        context.clearRect(x, y, size, size);
    };
    let increment = size/2;
    let loopexit = false;
    let rand = 0;
    let values = [];
    for(i1 = 0; i1 < size; i1++){
        values[i1] = [];
    }
    // an array that stores the value of each pixel.
    for(i1 = 0; i1 < 4; i1++) {
    // place the first pixels
        rand = Math.floor(Math.random()*256);
        ds_draw(rand, x + (i1%2 === 1 ? increment : 0), y + (i1%4 >= 2 ? increment : 0));
        values[(i1%2 === 1 ? increment : 0)][(i1%4 >= 2 ? increment : 0)] = rand;
    }
    for(; (increment%2) === 0 && increment && !loopexit; increment /= 2){
    // every iteration is another run of both diamonding and squaring
    // - i don't have reason to think the truthy check is necessary, but if
    //   increment did become 0 somehow, this would loop infinitely.
        for(i1 = increment/2; i1 < size && !loopexit; i1 += increment){
        // diamond step
        // -
        // runs for every valid column. i1 is x position
            for(i2=increment/2; i2 < size && !loopexit; i2 += increment){
            // runs for every valid y position within that row
                //context.fillStyle = "white";
                values[i1][i2] = ds_getvalue(size, modfunc, i1, i2, increment, "diamond", values);
                if(isNaN(values[i1][i2])) {
                    console.log("shits an tiddies");
                };
                ds_draw(values[i1][i2], x + i1, y + i2);
            }
        }
        for(i1 = 0; i1 < size && !loopexit; i1 += increment/2){
        // square step
        // -
        // runs for every valid column. ds_i1 is x position
            for(i2 = (i1%increment === 0 ? increment/2 : 0); i2 < size && !loopexit; i2 += increment){
            // runs for every valid y position within that row
                //context.fillStyle = "black";
                values[i1][i2] = ds_getvalue(size, modfunc, i1, i2, increment, "square", values);
                if(isNaN(values[i1][i2])) {
                    console.log("shits an tiddies");
                };
                ds_draw(values[i1][i2], x + i1, y + i2);
            }
        }
    }
    if(!context || drawfunc === "getvalues") {
        return values;
    };
}

const AAX = {
// "armature artist export". an object storing functions and objects related to
// armature artist, but used in other related projects.
    part_properties: {
    // the values will be converted into objects in initialize. the most
    // important property is type, a string representing how their data can
    // be stored. this also acts as a list of which getters exist. (except
    // for pose_exclusive properties, but those aren't underscored, so same
    // difference.)
    // - all of these will be converted into objects in initialize. this
    //   value will be their .type property, and they'll have a "children"
    //   array.
    // - a Part is nothing but underscored versions of all
    //   non-body_exclusive properties, and all of these getters as methods.
    // - if it's "body_exclusive", it can't be edited per frame, and it
    //   doesn't exist in frames, except as a getter.
    // - "pose_exclusive" means it doesn't exist in AAX.Bodys.
    // - "no_default" means it exists in both, but i've disallowed using the
    //   "default" value.
    //   - this is used for properties like coordinates, where it's best to
    //     make sure they don't change from changes to the parent
    //   - but also for properties that are at the wrong depth. generally,
    //     only properties on the lowest level can be "default", except for
    //     a few exceptions in .perspective.
    // - "pose_getset" is the same as pose_exclusive, except it also uses
    //   a getter/setter system, but for reasons totally unrelated to the
    //   system of "default"s.
    //   - for example, orient, stretch/widen, etc setters refresh the
    //     cache.oriented when they're changed, so that it doesn't have to
    //     run AAX.Part.orientedshape every time it creates an image from the
    //     3d shape.
    //   - the real value is underscored, just like the others.
    // - and some have empty strings because none of this applies. (they
    //   exist in both, and can be "default".)
    // - NOTE this also acts as a reference for which properties have
    //   getters.
    // - NOTE do not assume you can just change their types whenever you
    //   want! it's true that most code related to getters/setters checks
    //   this, but that does not mean everything is written with that kind
    //   of modularity in mind.
    //   - for example, AAX.abscoor will not work on poseobjs if x/y/z aren't
    //     no_default. i wrote that under the assumption that every part of
    //     your inputted armature has an x, y, and z. (which wouldn't be the
    //     case if they were "default" instead. AAX.poseobj deletes
    //     "default"s.)
    //   - it's not impossible, but don't expect it to work without rewriting
    //     code related to that property.
        tool: "pose_exclusive",
        body: "pose_exclusive",
        pose: "pose_exclusive",
        // references to the tool the Part is being used by, the AAX.Body it's
        // based on, and the pose it's part of.
        // - tool should be the object all the functions are in, but the only
        //   hard requirement is that it's an object with a drawsettings and
        //   color property, of the proper AAX DrawSettings/Color classes.
        name: "pose_exclusive",
        // string of the part's name. (just the string of the property name it's
        // stored under. otherwise, certain Part methods would be hard to use.)
        parent: "body_exclusive",
        // string of the part it should place itself relative to.
        // - "standpoint" will place it through absolute coordinates instead.
        //   make the torso or pelvis or something a child of this, and that
        //   part will be what you move to move the whole body.
        x: "no_default",
        y: "no_default",
        z: "no_default",
        // relative coordinates. (ie, its position in space minus its parent's
        // position in space)
        image: "no_default",
        image_front: "",
        image_right: "",
        // what part artist edits. a front image and right image.
        color1: "body_exclusive",
        color2: "body_exclusive",
        // the colors used in the image for 1 values and 2 values respectively.
        // - 1 pixels that have 1 or 2 neighbors on all cardinal sides will be
        //   replaced with AAX.Color.part_interior.
        perspective: "no_default",
        perspective_0: "",
        perspective_1: "",
        perspective_2: "",
        perspective_3: "",
        perspective_coor: "no_default",
        perspective_coor_0: "",
        perspective_coor_1: "",
        perspective_coor_2: "",
        perspective_coor_3: "",
        // an array-like object of images that are specific to a view. (the
        // normal .image.front and .image.right are used for unperspectived
        // visuals, these are used to show proper perspective.)
        // - the concepts behind this are sorta complicated... basically,
        //   because of perspective and camera angle, you can't have the
        //   positions and images all mesh with each other perfectly. things
        //   have to be inconsistent between views, because objects are
        //   positioned around the vanishing point and sized based on the
        //   distance from the camera.
        //   - this also includes camera angle stuff. angling it slightly at the
        //     ground instead of straight forward.
        // - 0, 1, 2, 3: images for each view. or they can be null, which means
        //   they just use the unperspectived images.
        // - coor: an array-like object with a screen x and screen y number for
        //   how it should move, relative to its "true" position in 3d space.
        //   - it can also be "auto", which means it's calculated automatically
        //     every time rather than having an unchanging manual setting.
        //   - the "perspective" draw toggle will draw a line between this
        //     position and the true position.
        hide: "no_default",
        // boolean for whether to hide the part. (there's no way to add parts
        // partway through the animation.)
        silhouette: "",
        // which silhouette group to use. (basically, you can make it so the
        // arms are outlined separately, in a different color.)
        // - stored as an array of a number (AAX.Color.silhouette index) and
        //   string (subgroup name. parts in the same group but different
        //   subgroups are drawn in the same color but with different outlines.)
        connection: "",
        // object for how it connects to the parent in the silhouette.
        // - if .type === "generation", .value is an array of two numbers for
        //   how many generations back/forward to connect to.
        //   - [1, 0] means it connects to the parent. [2, 0] means it connects
        //     to parent and grandparent. [0, 1] means it connects to children.
        // - if .type === "capsule", .value is a number used for the width of a
        //   capsule shape connecting the two parts. (it's used as an
        //   approximation of a neck.)
        shape: "",
        orient: "pose_getset",
        stretch: "pose_getset",
        widen: "pose_getset",
        // stuff involving 3d shapes:
        // - shape: object storing the points the shape is made of.
        //   - points
        //     - this isn't one unbroken array of coordinates, it's broken up
        //       into groups. each group is drawn by itself, since the
        //       algorithm for converting points to shapes can only create
        //       convex shapes.
        //     - points can be made into spheroids by including up to seven
        //       values.
        //       - four values: [3] is used for width, height, and depth
        //       - six values: [3], [4], [5] are used
        //       - seven values: [6] is an orientation quaternion
        //         (shape_string lets you create them with yz/xz/xy rotations
        //         though)
        //   - external
        //     - groups
        //     - points
        //     =
        //     - groups and points are objects indexed by body part, storing
        //       arrays of indexes for which groups/points follow that body
        //       part's scaling and orientation.
        // - orient: orientation quaternion, modified by the rotate or tilt
        //   pose tools.
        // - stretch, widen: scale factors. stretch expands it along the line
        //   to the parent, widen expands it in the other directions.
        //   - if stretch isn't applicable, (parent and child are on the same
        //     spot, or parent is standpoint) widen is used as an overall scale
        //     factor.
        cache: "pose_exclusive",
        // this one is special.
        // - what "cache" means for this project is, "data that is stored
        //   somewhere else already or could be calculated, but it's kept
        //   around to save time"
        // - the only reason it's necessary is the 3d shape system.
        //   calculating that on the spot takes too long, it has to create the
        //   spheroids and figure out the orientation of everything. instead,
        //   the .orientedshape (a getter that calculates this) is saved,
        //   reused, and redefined when necessary.
        //   when properties become obsolete, they are set as null. whenever
        //   the property is needed, it uses it if it's there and generates it
        //   again if it's null.
        // =
        // - oriented: the .orientedshape of the part, ie the shape after
        //   scaling and orientation is applied.
        // - rasterize: an object of .rasterize() data. front, right, 0-3.
        //   - each view is an {oddness, image} object. (oddness is what
        //     image_oddness it had at the time of the image's creation, so
        //     that when reusing the image, it can adjust for what the oddness
        //     is now.)
        //   - or they're null if it hasn't created the image yet.
    },
    // other important vocabulary:
    // - oddness: refers to whether the absolute coordinates of a part have
    //   some axes that are .5 rather than .0.
    //   - a part that's supposed to be 4 units wide will have its outlines
    //     drawn four pixels apart, making the actual drawing five pixels
    //     wide.
    //   - but if you want to increase the dimensions by 1, you need to have
    //     it center on .5 coordinates rather than .0 coordinates.
    //   - and it's also super impossible to move things by half-pixels
    //     through clicks and stuff, since the smallest unit is one pixel.
    //   - that means there's buttons to move something from a .0 coordinate
    //     to a .5 coordinate and vice versa.
    //   - oddness changes require 1-pixel changes in dimensions, so you
    //     can't just use the same image without editing it. the program
    //     either doubles the zero row/column into -.5 and .5 columns, or
    //     collapses -.5 and .5 into zero. (for the latter, it chooses
    //     whichever pixel has a higher value. color1 pixels over empty
    //     pixels, color2 pixels over color1 pixels.)
    //   - this is all kind of a pain in the ass to program, i'll have you
    //     know.
    // most of body defining gets done in .initialize.
    // - creates coordinates and boxes all at once
    // - converts image
    // - creates hide, perspective, silhouette, connection, color1,
    //   color2
    // - symmetrical duplicates
    Body: class {
        constructor() {
        // never ever use this directly, because, well... look at it.
        // - it's empty because AAX.Body.new is what actually does the
        //   heavy-lifting.
        // - basically, 99% of the time when you need to create a body, you need
        //   to also be prepared for the possibility of the bodytext being
        //   invalid
        // - i do that by having it return an error string, but you can't have a
        //   class constructor return a string.
        }
        static new(text) {
		// converts text to a Body. returns a string describing the error if the
		// input is invalid.
		// - temporary properties created in here:
		//   - dim: one number, or an array of three. used to determine the
		//     bounds of the image text or the ellipse it'll use in place of
		//     one.
		//   - branch_color1, branch_color2: arrays of colors that generations of
		//     descendants cycle through for their color1 or color2
		//     - color1 and color2 override this and any ancestors'
		//       branch_color, setting this color for this part only.
		//   - branch_silhouette: silhouette number, which works similarly
		//     - except it's just one value instead of an array. if the shoulder
		//       has a .branch_silhouette of 1, that's applied to the entire
		//       arm. but if the hand has a .silhouette of 0, the hand will be 0
		//       instead
		//   - no_mirror: means it shouldn't get a symmetrical counterpart,
		//     despite a "l_" or "r_" prefix. this is assigned by branch too.
		//     - sort of. it won't create a symmetrical counterpart if the
		//       parent name has no symmetrical counterpart. in practice, it's
		//       mostly the same as a branchassign. except i guess that it won't
		//       affect the arms if you add no_mirror to the torso or w/e
			let i1 = 0;
			let i2 = 0;
			let i3 = 0;
			let i4 = 0;
			let loop = new Loop("AAX.Body.new");
			text = uncomment(text).split("\n###\n");
			if(text.length < 1) {
				return "invalid input. (incorrect number of sections.)";
			};
			for(i1 = 0; i1 < text.length; i1++) {
				loop.tick(1);
				if(i1 === 0) {
				// spaces at the beginning of lines are part of the family
				// syntax.
					let index = text[i1].length - text[i1].trimStart().length;
					let loopexit = false;
					for(; index > 0 && !loopexit; index--) {
						loop.tick(2);
						if(index !== 0) {
							let char = text[i1][index - 1];
							if(!char.trim() && ![" ", String.fromCharCode(9)].includes(char)) {
								loopexit = true;
							}
						}
					}
					loop.end();
					// index is now the index of the first letter, space or
					// indent, but not other whitespace.
					text[i1] = text[i1].slice(index).trimEnd();
				}
				else {
					text[i1] = text[i1].trim();
				}
			}
			loop.end();
			// trimmed
			let family = text[0].split(String.fromCharCode(10));
			// field 1: family tree (parent, coordinates)
			let lowest = null;
			for(i1 = 0; i1 < family.length; i1++) {
				loop.tick(1);
				let indent = family[i1].length - family[i1].trimStart().length;
				if(lowest === null || indent < lowest) {
					lowest = indent;
				};
				let string = family[i1].trim();
				let index = string.lastIndexOf(":");
				if(index === -1) {
					return "invalid input. (a line in the family tree area has no colon.)";
				};
				let name = string.slice(0, index).trim();
				if(name === "standpoint") {
					return "invalid input. (\"standpoint\" is a reserved word.)";
				}
				else if(name in AAX.Body.prototype) {
				// matches an object/Body method/property. (ex: making a part
                // called "hasOwnProperty" will cover up the hasOwnProperty
                // method and make it unusable)
					return "invalid input. (\"" + name + "\" is an invalid part name for technical reasons.)";
				}
				let coor = AAX.strings.coor(string.slice(index + 1));
				if(!coor) {
					return "invalid input. (the " + name + " part has invalid coordinates. it must be three numbers.)";
				}
				family[i1] = {
					name,
					generation: indent,
					coor,
				};
			}
			loop.end();
			if(lowest) {
				for(i1 = 0; i1 < family.length; i1++) {
					loop.tick(1);
					family[i1].generation -= lowest;
				}
				loop.end();
			}
			let obj = {};
			// where all the parts are stored in, for now
			for(i1 = 0; i1 < family.length; i1++) {
				loop.tick(1);
				obj[ family[i1].name ] = {
					x: family[i1].coor[0],
					y: family[i1].coor[1],
					z: family[i1].coor[2],
				};
				let part = obj[ family[i1].name ];
				for(i2 = i1 - 1; i2 >= 0; i2--) {
				// search backward. the first one of a lower generation is the
				// parent.
					loop.tick(2);
					if(family[i2].generation < family[i1].generation) {
						part.parent = family[i2].name;
						i2 = -1;
						// exit
					}
				}
				loop.end();
				part.parent ??= "standpoint";
				// if no parent exists, use standpoint.
			};
			loop.end();
			let has_shape = [];
			// array of the names of parts with non-default shapes.
			if(text.length >= 2) {
			// field 2: shapes/images
				let data = text[1].split(String.fromCharCode(10));
				let start = null;
				// line index for where all the image text for a part begins and
				// ends.
				let name = null;
				// part that lines are associated with at the moment.
				for(i1 = 0; i1 < data.length; i1++) {
					loop.tick(1);
					data[i1] = data[i1].trim();
					let line = data[i1];
					if(line.startsWith("[") && line.endsWith("]")) {
						line = line.slice(1, -1).trim();
						if(obj.hasOwnProperty(line)) {
							if(start !== null) {
							// if this isn't the first name you've encountered, save
							// the area from here to the previous name under the
							// previous name's part.
								obj[name].imagetext = data.slice(start, i1);
							};
							start = i1;
							name = line;
						}
						else {
							return "invalid input. (the name \"" + line + "\" in the image field doesn't match any body parts.)";
						}
					}
				}
				loop.end();
				if(start !== null && name !== null) {
					obj[name].imagetext = data.slice(start, data.length);
				};
				// save the last image too.
			}
			for(i1 in obj) {
				if(obj.hasOwnProperty(i1)) {
				// convert all images. if they don't have images, at least make
				// sure shape, image, and perspective objects are created.
				// - not gonna convert objects from text yet. can't do that
				//   until it can figure out AAX.image_oddness, which it can't do
				//   until it has perspective_coor filled.
					loop.tick(1);
					let part = obj[i1];
					let image = structuredClone(part.imagetext) ?? null;
					// shape/image defining code
					delete part.imagetext;
					part.shape = {
						points: [],
						external: {
							groups: {},
							points: {},
						},
					};
					part.image = {
						front: null,
						right: null,
					};
					part.perspective = {
						0: null,
						1: null,
						2: null,
						3: null,
						coor: {
							0: "auto",
							1: "auto",
							2: "auto",
							3: "auto",
						},
					};
					// make sure all of these properties always exist, even if
					// the user didn't define them
					if(image) {
						image = image.slice(1).join("\n").split("||");
						// omit the part name, split into shape,
						// unperspectived, and perspectived (also makes sure
						// it isn't a reference)
						if(image.length >= 1 && image[0].trim()) {
						// if there's a shape
							let temp = AAX.strings.shape(image[0], obj, i1);
							if(temp) {
							// if it didn't error from invalid inputs, use that.
								part.shape = structuredClone(temp);
								has_shape[has_shape.length] = i1;
							}
						};
						if(image.length >= 2 && image[1].trim()) {
						// if there's unperspectived images
							part.image = {};
							let string = image[1].split("|");
							if(string.length >= 1 && string[0].trim()) {
								part.image.front = string[0];
							};
							if(string.length >= 2 && string[1].trim()) {
								part.image.right = string[1];
							};
							if(string.length > 2) {
								return "invalid input. (there's more than two unperspectived images. the most there should be is a front image and right image.)";
							};
						};
						if(image.length >= 3 && image[2].trim()) {
						// if there's perspectived images
							let string = image[2].split("|");
							for(i2 = 0; i2 < Math.min(4, string.length); i2++) {
								loop.tick(2);
								if(string[i2].trim()) {
									part.perspective[i2] = string[i2];
								};
							}
							loop.end();
							if(string.length > 4) {
								return "invalid input. (there's more than four perspectived images. the most there should be is one for each view.)";
							};
						}
						if(image.length > 3) {
							return "invalid input. (|| is used to divide shapes from unperspectived images and unperspectived images from perspectived images, but there's more than two for " + i1 + ".)";
						};
					};
				}
			};
			loop.end();
			// by the end of this loop, part.image must exist, with
			// a front and right, filled either by null or by text.
			if(text.length >= 3) {
			// field 3: properties (colors, connections, etc.)
				let data = text[2].split(String.fromCharCode(10));
				for(i1 = 1; i1 < data.length; i1++) {
					loop.tick(1);
					if(!data[i1].trim()) {
						data.splice(i1, 1);
						i1--;
					}
					else if(data[i1].trimStart().length < data[i1].length) {
						data[i1 - 1] += data[i1];
						data.splice(i1, 1);
						i1--;
					};
				}
				loop.end();
				// lines that start with whitespace are added to previous lines.
				// (that way, you can indent them if the line's getting way too
				// long.)
				for(i1 = 0; i1 < data.length; i1++) {
					loop.tick(1);
					let colon = data[i1].indexOf(":");
					if(colon === -1) {
						return "invalid input. (an unindented line in the properties area has no colon.)";
					};
					let name = data[i1].slice(0, colon).trim();
					if(obj.hasOwnProperty(name)) {
						obj[name].propertytext = trimspecial(data[i1].slice(colon + 1), " ")
					}
					else {
						return "invalid input. (a line in the properties area is for a body part that wasn't in the family tree.)";
					};
				}
				loop.end();
				// save the text as a property, just like imagetext
				function insideandout(string, find) {
				// finds (find + "(") within string, and returns an object of
				// the inside and outside of those parentheses. (or null if it
				// doesn't find it.)
					let index = string.indexOf(find + "(");
					if(index !== -1) {
						index = [
							index,
							index + string.slice(index).indexOf(")") + 1
						];
						return (
							index[1] === -1
							?
							null
							:
							{
								inside: string.slice(index[0] + find.length + 1, index[1] - 1),
								outside: string.slice(0, index[0]) + string.slice(index[1]),
							}
						);
					}
					else {
						return null;
					}
				};
				for(i1 in obj) {
					if(obj.hasOwnProperty(i1)) {
						loop.tick(1);
						let part = obj[i1];
						let line = part.propertytext ?? "";
						//console.log(i1 + ": " + line);
						delete part.propertytext;
						let temp = null;
						for(i2 = 0; i2 < 2; i2++) {
							loop.tick(2);
							temp = insideandout(line, "color" + (i2 + 1));
							if(temp) {
								line = temp.outside;
								temp = temp.inside.split(",");
								for(i3 = 0; i3 < temp.length; i3++) {
									loop.tick(3);
									let num = Number(temp[i3]);
									if(Number.isInteger(num) && num >= 0) {
										temp[i3] = num;
									};
								}
								loop.end();
								// numberize if possible
								if(temp.length) {
									part["branch_color" + (i2 + 1)] = structuredClone(temp);
								}
							};
							temp = insideandout(line, "color" + (i2 + 1) + "*");
							if(temp) {
								line = temp.outside;
								temp = temp.inside;
								let num = Number(temp);
								if(Number.isInteger(num) && num >= 0) {
									temp = num;
								};
								part["color" + (i2 + 1)] = temp;
								//console.log(i1 + ": " + temp);
							};
						}
						loop.end();
						// branch_color, color
						temp = insideandout(line, "silhouette");
						if(temp) {
							line = temp.outside;
							temp = temp.inside;
							const inheritance = !temp.startsWith("*");
							if(!inheritance) {
								temp = temp.slice(1);
							};
							let sub = 0;
							// stands for "subgroup"
							for(sub = temp.length - 1; sub >= 0 && temp[sub].toLowerCase() !== temp[sub].toUpperCase(); sub--) {
							// find the last non-letter character
								loop.tick(2);
							}
							loop.end();
							sub++;
							// so that it's at the end of that last non-letter, and
							// can be used as a slice index
							temp = [
								temp.slice(0, sub),
								temp.slice(sub)
							];
							let num = Number(temp[0]);
							sub = temp[1];
							if(!Number.isInteger(num) || num < 0) {
								return "invalid input. (invalid silhouette group number. must be a positive integer.)";
							};
							part["branch_".repeat(inheritance) + "silhouette"] = [num, sub];
						};
						// silhouette, branch_silhouette
						temp = insideandout(line, "perspective");
						if(temp) {
							line = temp.outside;
							temp = temp.inside.split(",");
							let coor = [
								"auto",
								"auto",
								"auto",
								"auto"
							];
							let numofautos = 0;
							for(i2 = 0; i2 < 4; i2++) {
								loop.tick(2);
								let index = i2*2 - numofautos;
								if(temp[index] === "auto") {
									coor[i2] = "auto";
									numofautos++;
								}
								else {
									let num = [
										Number(temp[index]),
										Number(temp[index + 1])
									];
									if(isNaN(num[0]) || isNaN(num[1])) {
										return "invalid input. (invalid perspective coordinates.)";
									}
									coor[i2] = structuredClone(num);
								}
							}
							loop.end();
							part.perspective.coor = structuredClone(coor);
						};
						// perspective coordinates
						temp = insideandout(line, "capsule");
						if(temp) {
							line = temp.outside;
							temp = AAX.posint(temp.inside);
							if(isNaN(temp)) {
								return "invalid input. (invalid capsule width.)";
							};
							part.connection = {
								type: "capsule",
								value: temp,
							};
						};
						temp = insideandout(line, "generation");
						if(temp) {
							line = temp.outside;
							let value = temp.inside.split(",");
							value = [
								Number(value[0]),
								Number(value[1] ?? 0)
							];
							if(!Number.isInteger(value[0]) || !Number.isInteger(value[1])) {
								return "invalid input. (generation connections are supposed to be integers representing how many generations back/forward you want the part to connect to.)";
							}
							else {
								part.connection = {
									type: "generation",
									value,
								};
							}
						};
						// connection
						for(i2 = 0; i2 < 2; i2++) {
							loop.tick(2);
							let word = ["hide", "no_mirror"][i2];
							part[word] = line.includes(word + "()");
							if(part[word]) {
								line = line.replace(word + "()", "");
							};
						}
						// hide, no_mirror
						line = line.trim();
						if(line) {
							console.log(i1 + " has text of unknown meaning: `" + line + "`");
						};
					}
				}
				loop.end();
			}
			//
			// text interpretation is done, time to convert it to a usable body.
			//
			let body = new AAX.Body();
			// final product
			for(i1 in obj) {
				loop.tick(1);
				if(obj.hasOwnProperty(i1)) {
					body[i1] = {};
					let part = body[i1];
					let order = [
						"parent",
						"x", "y", "z",
						"shape",
						"image",
						"perspective",
						"hide"
					];
					for(i2 = 0; i2 < order.length; i2++) {
						loop.tick(2);
						part[ order[i2] ] = structuredClone( obj[i1][ order[i2] ] );
					};
					loop.end();
				}
			}
			loop.end();
			// now that every body part exists, we can do stuff like
			// branch_color.
			function branchassign(body, part, property, values) {
			// assigns colors or silhouette groups to the named and to all its
			// descendants.
			// - values: an array of values to cycle through with every
			//   generation. (ie if it's [1, 2], the named part will be 1, all
			//   children will be 2, all grandchildren will be 1, etc)
				let i1 = 0;
				let loop = new Loop("AAX.Body.new branchassign");
				if(!Array.isArray(values)) {
					values = [values];
				}
				body[part][property] = structuredClone(values[0]);
				let temp = structuredClone(values[0]);
				values.splice(0, 1);
				values[values.length] = temp;
				// cycle through
				for (i1 in body) {
					loop.tick(1);
					if(body.hasOwnProperty(i1) && body[i1].parent === part) {
						branchassign(body, i1, property, structuredClone(values));
					};
				}
				loop.end();
			};
			let order = AAX.getdesc(body);
			branchassign(body, order[0], "color1", [1, 2]);
			branchassign(body, order[0], "color2", [0]);
			branchassign(body, order[0], "silhouette", [[0, ""]]);
			//console.log(body);
			// set the default colors/silhouette
			for (i1 in body) {
				loop.tick(1);
				if (body.hasOwnProperty(i1)) {
					if(obj[i1].hasOwnProperty("branch_color1")) {
						branchassign(body, i1, "color1", obj[i1].branch_color1);
					};
					if(obj[i1].hasOwnProperty("branch_color2")) {
						branchassign(body, i1, "color2", obj[i1].branch_color2);
					};
					if(obj[i1].hasOwnProperty("branch_silhouette")) {
						branchassign(body, i1, "silhouette", [obj[i1].branch_silhouette]);
					};
					if(obj[i1].hasOwnProperty("no_mirror") && obj[i1].no_mirror) {
						//branchassign(body, i1, "silhouette", obj[i1].no_mirror);
					};
				};
			}
			loop.end();
			// a loop to set the branch stuff
			for (i1 in body) {
				loop.tick(1);
				if (body.hasOwnProperty(i1)) {
					if(obj[i1].hasOwnProperty("color1")) {
						body[i1].color1 = obj[i1].color1;
					};
					if(obj[i1].hasOwnProperty("color2")) {
						body[i1].color2 = obj[i1].color2;
					};
					if(obj[i1].hasOwnProperty("silhouette")) {
						body[i1].silhouette = structuredClone(obj[i1].silhouette);
					};
				};
			}
			loop.end();
			// a loop to set the non-branch stuff
			function simpleshape(shape) {
			// if a shape is a single point that doesn't use external, it
			// returns that point.
				let point = null;
				let loop = new Loop("AAX.Body.new simpleshape");
				for(let i1 = 0; i1 < shape.points.length; i1++) {
				// search every group
					loop.tick(1);
					for(let i2 = 0; i2 < shape.points[i1].length; i2++) {
					// search every point
						loop.tick(2);
						if(point !== null) {
						// this isn't the first point
							return null;
						}
						point = structuredClone(shape.points[i1][i2]);
						let ref = shape.external.points;
						for(let i3 in ref) {
							loop.tick(3);
							if(ref.hasOwnProperty(i3) && ref[i3].includes(0)) {
							// external-oriented
								return null;
							}
						}
						loop.end();
						ref = shape.external.groups;
						for(let i3 in ref) {
							loop.tick(3);
							if(ref.hasOwnProperty(i3) && ref[i3].includes(i1)) {
							// external-oriented
								return null;
							}
						}
						loop.end();
					}
					loop.end();
				}
				loop.end();
				return point;
			}
			for (i1 in body) {
				loop.tick(1);
				if (body.hasOwnProperty(i1)) {
				// interpret images
					let part = body[i1];
					part.connection = structuredClone(obj[i1].connection ?? {type: "generation", value: [1, 0]});
					// done here so that it's right after silhouette.
					// - if it's absent, connect to parents.
					const oddness = AAX.oddness(body, i1);
					for(i2 = -2; i2 < 4; i2++) {
						loop.tick(2);
						const imageobj = part[i2 < 0 ? "image" : "perspective"];
						const view = i2 === -2 ? "front" : i2 === -1 ? "right" : i2;
						if(imageobj[view] !== null) {
							const oddness = AAX.image_oddness(body, i1, view);
							let temp = Raster.fromtext(imageobj[view], true);
							if(temp === null) {
								console.log("invalid image text. the line lengths are inconsistent, or characters besides -, %, and * were used.");
							}
							else {
								let image = structuredClone(temp.raster);
								const w = temp.w;
								const h = Math.ceil(image.length/w);
								const old_oddness = [
									invertboolean(oddness[0], AAX.onedim(0, oddness[0]) !== w%2),
									invertboolean(oddness[1], AAX.onedim(0, oddness[1]) !== h%2)
								];
								// if the %2 doesn't match the %2 an image of
								// this part's oddness should have, then the
								// oddness must be different in that axis.
								let rect = Raster.dimrect(...AAX.l_dim(image.length, old_oddness));
								image = AAX.sq_raster.squarify(image, rect);
								// make it a square image
								image = AAX.sq_raster.changeoddness(image, old_oddness, oddness);
								// make it match the ideal oddness
								image = AAX.sq_raster.autocrop(image, oddness);
								// crop it as much as possible without cutting
								// content off
								imageobj[view] = structuredClone(image);
							};
							temp = simpleshape(part.shape);
							if(temp !== null) {
								if(
									temp[0] || temp[1] || temp[2]
									||
									temp.length < 4
									||
									(temp.length >= 5 && temp[4] !== temp[3])
									||
									(temp.length >= 6 && temp[5] !== temp[3])
								) {
									temp === null;
								}
							}
							// make it null unless it's a sphere centered on [0,
							// 0, 0]
							if(false && obj[view] === null && i2 < 0 && temp !== null) {
							// if there's no image, it's an unperspectived, and
							// the shape is a single sphere, make an ellipse
							// image instead.
								const w = AAX.onedim(temp[3], oddness[0]);
								const h = AAX.onedim(temp[3], oddness[1]);
								let image = [];
								for(i3 = 0; i3 < w*h; i3++) {
								// empty image
									loop.tick(3);
									image[i3] = 0;
								}
								loop.end();
								part.image[view] = Raster.ellipse(image, w, 0, 0, w - 1, h - 1);
							};
						};
					}
					loop.end();
				}
			}
			loop.end();
			for (i1 in body) {
				loop.tick(1);
				if (
					body.hasOwnProperty(i1)
					&&
					(i1.startsWith("l_") || i1.startsWith("r_"))
					&&
					!body[i1].hasOwnProperty(AAX.sym_namer(i1))
					&&
					(!obj[i1].hasOwnProperty("no_mirror") || !obj[i1].no_mirror)
				) {
				// if it's a left/right part, doesn't already have a
				// counterpart, and doesn't have a no_mirror command, make a
				// symmetrical duplicate.
				// - NOTE this needs to run in getdesc order. i'm only leaving
				//   it alone because that's kind of required already, for field
				//   1's family structure thing.
				//   - if children are run before their parents, you could get
				//     some symmetrical counterparts not getting made because
				//     their parent hasn't been made yet.
					const old_name = i1;
					const new_name = AAX.sym_namer(i1);
					const old_part = body[i1];
					body[new_name] = structuredClone(old_part);
					let new_part = body[new_name];
					new_part.parent = AAX.sym_namer(old_part.parent);
					// parent
					if(!old_part.silhouette[1] && old_part.silhouette[0]) {
					// put them in different silhouette subgroups
						old_part.silhouette[1] = old_name[0];
						new_part.silhouette[1] = new_name[0];
					};
					if(!body.hasOwnProperty(new_part.parent)) {
						delete body[new_name];
					}
					else {
						AAX.mirror(body, new_name, "x");
						// coordinates, image, perspective
					};
				}
			}
			loop.end();
			return body;
        }
        static clone(body) {
        // structuredClone that preserves the class.
            let copy = new AAX.Body();
            for(let i1 in body) {
                if(body.hasOwnProperty(i1)) {
                    copy[i1] = structuredClone(body[i1]);
                }
            }
            return copy;
        }
        static templates = {
        // example bodytexts, used in places like the armature artist bodytext
        // selector
			hand:
`wrist:			0, 0, 0
 thumb_1:		-2.5, -1.5, .5
  thumb_2:		-5, -4, 0
   thumb_3:		-1, -3, 0
    thumb_4:	0, -2, 0
 index_1:		-4.5, -12.5, -.5
  index_2:		0, -6, 0
   index_3:		0, -3, 0
    index_4:	0, -2, 0
 middle_1:		-.5, -12.5, -1.5
  middle_2:		0, -7, 0
   middle_3:	0, -3, 0
    middle_4:	0, -2, 0
 ring_1:		3.5, -11.5, -.5
  ring_2:		0, -6, 0
   ring_3:		0, -3, 0
    ring_4:		0, -2, 0
 pinkie_1:		7.5, -9.5, .5
  pinkie_2:		0, -3, 0
   pinkie_3:	0, -3, 0
    pinkie_4:	0, -3, 0
// the spacing between knuckles/fingers is about 4
// the gap when the fingers point straight up is less than 1/4 of that, but making it 1 makes poses more clear
// so the finger width is 3
###
[ wrist ]
0, 0, 0, 9, 5, 5
[ thumb_1 ]
0, 0, 0, 3
[ thumb_2 ]
0, 0, 0, 4
[ thumb_3 ]
0, 0, 0, 3
[ thumb_4 ]
0, 0, 0, 3
[ index_1 ]
0, 0, 0, 3
[ index_2 ]
0, 0, 0, 4
[ index_3 ]
0, 0, 0, 3
[ index_4 ]
0, 0, 0, 3
[ middle_1 ]
0, 0, 0, 3
[ middle_2 ]
0, 0, 0, 4
[ middle_3 ]
0, 0, 0, 3
[ middle_4 ]
0, 0, 0, 3
[ ring_1 ]
0, 0, 0, 3
[ ring_2 ]
0, 0, 0, 4
[ ring_3 ]
0, 0, 0, 3
[ ring_4 ]
0, 0, 0, 3
[ pinkie_1 ]
0, 0, 0, 3
[ pinkie_2 ]
0, 0, 0, 4
[ pinkie_3 ]
0, 0, 0, 3
[ pinkie_4 ]
0, 0, 0, 3
###
wrist:
    generation(0, 1)
    color1*(3)
	silhouette(0a)
thumb_1:
    generation(0)
    color1(4, 3)
thumb_2:
    generation(2)
    silhouette(0b)
//thumb_3:
//thumb_4:
index_1:
    generation(0)
    silhouette(1a)
//index_2:
//index_3:
//index_4:
middle_1:
	generation(0)
	silhouette(1b)
//middle_2:
//middle_3:
//middle_4:
ring_1:
    generation(0)
    silhouette(1c)
//ring_2:
//ring_3:
//ring_4:
pinkie_1:
    generation(0)
    silhouette(1d)
//pinkie_2:
//pinkie_3:
//pinkie_4:	`,
			stocky:
`pelvis:        0, -35, 0
 midsection:   0, -8, 5
 torso:        0, -19, 1
  neckbase:    0, -6, -3
   headbase:   0, -8, 1
    head:      0, -10, 2
  manubrium:   0, 0, 6
   l_shoulder: -15, 4, -8
    l_elbow:   -1.5, 14.5, -1.5
     l_wrist:  0.5, 13.5, 0.5
      l_hand:  1, 2, 1
 l_hip:        -7, 3, 0
  l_knee:      -0.5, 14.5, 0.5
   l_ankle:    0.5, 13.5, -0.5
    l_toe:     -1, 1, 8
###
[ head ]
---------------------------
---------------------------
---------------------------
---------------------------
---------------------------
----------%%%%%%%----------
--------%%%%%%%%%%%--------
-------%%%%%%%%%%%%%-------
------%%%%%%%%%%%%%%%------
------%%%%%%%%%%%%%%%------
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%*%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
------%%%%%%%%%%%%%%%------
------%%%%%%%%%%%%%%%------
-------%%%%%%%%%%%%%-------
-------%%%%%%%%%%%%%-------
--------%%%%%%%%%%%--------
---------%%%%%%%%%---------
-----------%%%%%-----------
---------------------------
|
---------------------------
---------------------------
---------------------------
---------------------------
---------------------------
----------%%%%%%%----------
--------%%%%%%%%%%%--------
-------%%%%%%%%%%%%%-------
------%%%%%%%%%%%%%%%------
------%%%%%%%%%%%%%%%------
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%*%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%%-----
-----%%%%%%%%%%%%%%%%------
-----%%%%%%%%%%%%%%%%------
-----%%%%%%%%%%%%%%%-------
------%%%%%%%%%%%%%--------
------%%%%%%%%%%%%---------
------%%%%%%%%%%%----------
-------%%%%%%%%------------
-------%%%%%---------------
---------------------------
[ torso ]
-6, -9, 2
x
-12, -3, -8
x
yz
xyz
-6, 13, -4
x
[ midsection ]
0, -8, 0
y
-8, -4, 4
z
y
yz
x
xz
xy
xyz
[ pelvis ]
// structured sort of like the midsection
-8, -8, 1
x
-6, -2, 7
x
-4, 4, 7
x
-4, 8, -1
x
-6, -4, -7
x
// two rings of points
-12, 0, 0
x
// the tip
[ l_shoulder ]
0, 0, 0, 10, 10, 10
[ l_elbow ]
0, 0, 0, 9, 9, 9
[ l_wrist ]
0, 0, 0, 8, 8, 8
[ l_hand ]
0, 0, 0, 10, 12, 10
[ l_hip ]
0, 0, 0, 10, 10, 10
[ l_knee ]
0, 0, 0, 9, 9, 9
[ l_ankle ]
0, 0, 0, 8, 8, 8
[ l_toe ]
0, 0, 0, 10, 6, 6
###
midsection:	color1*(3)
torso:
	color1(2, 1)
	generation(1, 2)
neckbase:	generation(0)
headbase:	capsule(6)
head:
	generation(0)
	silhouette(0b)
manubrium:	generation(0)
l_shoulder:
	color1(3, 4)
	silhouette(1)
l_hand:		generation(0)
l_hip:
	generation(0)
	silhouette(2)
l_knee:		generation(2)`,
			standard:
`pelvis:           0,  -25,    0
 midsection:      0,   -2,    2
 torso:           0,   -7,    0.5
  neckbase:       0,   -6,   -0.5
   headbase:      0,   -4,    0
    head:         0,   -8,    0
  manubrium:      0,   -3,    2.5
   l_shoulder:   -6,    3,   -3
    l_elbow:     -2,    8,   -1
     l_wrist:    -1.5,  7.5, -1.5
      l_hand:     0,    2.5,  0.5
 l_hip:          -3,    2,    1
  l_knee:        -0.5, 10.5, -0.5
   l_ankle:      -0.5, 10.5, -0.5
    l_toe:       -0.5,  0.5,  4.5
###
[ pelvis ]
-2, 1, 3
x
-3, -1, 3
x
// front
0, 3, -1
-2, -3, -3
x
-4, 1, -1
x
// back
[ midsection ]
0, -4, 0
y
// point
0, -2, -2
y
-2, -2, 2
x
y
xy
-4, -2, 0
x
y
xy
// vertical pentagonal prism
[ torso ]
0, -1, 4
// front point
-2, -5, 2
x
-6, -1, 2
x
// front
-4, 5, -2
x
// bottom
-2, -3, -4
x
-6, 1, -4
x
0, 1, -4
// back
[ neckbase ]
0, 0, 0
[ headbase ]
0, 0, 0
[ head ]
0, -5, 5
z
//
0, -8, 0
-5, -7, 0
x
-8, -2, 3//-8, -4, 4
x
z
xz
-5, -1, 8
x
z
xz
// top-front and top-back heptagons
0, 7, 8
//
-8, 3, 3//-8, 3, 4
x
-5, 8, 1
x
0, 11, 5
// bottom-front heptagon
0, 9, -3
//
-8, 3, -1//-8, 3, -1
x
// bottom-back heptagon
// notes for making a jaw:
// - make a head child whose relative coordinates are [0, 2, -1], aligning with
//   [-6, 2, -1] and its x inversion
// - [0, 5, 6] should be duplicated to this shape
// - [-4, 6, 1], its x inversion, and [0, 8, 4] should be moved to it (account
//   for the fact that they're relative to [0, 2, -1] now instead of the head's
//   origin)
[ manubrium ]
0, 0, 0
[ l_shoulder ]
0, 0, 0, 4
[ l_elbow ]
0, 0, 0, 4
[ l_wrist ]
||
----------
----------
----------
----%%----
---%%%%---
---%%%%---
---%%%%---
---%%%%---
---%%%%---
----%%----
|
----------
----------
----------
----%%----
---%%%%---
--%%%%%---
--%%%%%---
--%%%%%---
--%%%%%---
---%%%----
[ l_hand ]
0, 0, 0
[ l_hip ]
0, 0, 0, 6
[ l_knee ]
0, 0, 0, 4
[ l_ankle ]
0, 0, 0, 4
[ l_toe ]
0, 0, 0, 3, 1, 1
###
midsection:
	color1*(3)
torso:
	color1(2, 1)
	generation(1, 2)
neckbase:	generation(0)
headbase:
	capsule(6)
head:
	generation(0)
	silhouette(0b)
manubrium:	generation(0)
l_shoulder:
	color1(3, 4)
	silhouette(1)
l_hand:
	generation(0)
l_hip:
	color1(1, 2)
l_knee:
	generation(2)
	silhouette(2)`,
		}
    },
    Part: class {
    // specifically, a part in aa.frames. body parts are not saved as this,
    // and neither are states or aa.anims frames.
    // - mostly the same as body, except there's two versions of every
    //   property: one with an underscore at the beginning, and one without.
    // - the _ versions represent the true value of the property. the non-_
    //   are getters for what's actually used.
    // - this is because most properties can be set as "default", meaning it
    //   uses whatever value is in the body. for most poses, the only thing
    //   that changes is the coordinates.
    // - plus for some properties, like color and the perspective images,
    //   there's already values that mean "go ask your mom". this gets
    //   around those too.
    // - properties that can't be edited per frame, like parent, don't have
    //   _ versions.
        constructor(tool, body, pose, name) {
            let i1 = 0;
            let loop = new Loop("AAX.Part constructor");
            if(
                typeof tool !== "object"
                ||
                !((tool.drawsettings ?? null) instanceof AAX.DrawSettings)
                ||
                !((tool.color ?? null) instanceof AAX.Color)
                ||
                !(body instanceof AAX.Body)
                ||
                typeof pose !== "object"
                ||
                typeof name !== "string"
            ) {
                console.log("invalid arguments.");
                return;
            }
            this.tool = tool;
            this.body = body;
            this.pose = pose;
            this.name = name;
            this.cache = structuredClone(AAX.cache_init);
            // initialize pose_exclusive properties
            this._orient = Quat.new();
            this._stretch = 1;
            this._widen = 1;
            // create the underscored values of pose_getset properties
            let ref = AAX.part_properties;
            let _this = this;
            function makeproperty(object, property) {
            // makes a property, and all its children.
            // - property should be a string from AAX.part_properties. (ie,
            //   don't trim the beginning.)
                let i1 = 0;
                let loop = new Loop("AAX.Part constructor makeproperty");
                let array = property.split("_");
                let name = array[array.length - 1];
                if(object === _this) {
                    name = "_" + name;
                };
                if(ref[property].type === "no_default") {
                    if(ref[property].children.length) {
                        object[name] = {};
                        for(i1 = 0; i1 < ref[property].children.length; i1++) {
                            loop.tick(1);
                            makeproperty(object[name], ref[property].children[i1]);
                        }
                        loop.end();
                    }
                    else {
                        let value = _this.bodyref;
                        for(i1 = 0; i1 < array.length; i1++) {
                            loop.tick(1);
                            value = value[ array[i1] ];
                        }
                        loop.end();
                        object[name] = structuredClone(value);
                    }
                }
                else {
                    object[name] = "default";
                };
            }
            for(i1 in ref) {
                loop.tick(1);
                if(ref.hasOwnProperty(i1) && !["body_exclusive", "pose_exclusive", "pose_getset"].includes(ref[i1].type) && !i1.includes("_")) {
                    makeproperty(this, i1);
                }
            }
            loop.end();
        }
        static fromobj(tool, body, pose, name, obj) {
        // converts a partobj back to a Part.
            let part = new AAX.Part(tool, body, pose, name);
            for(let i1 in obj) {
                if(obj.hasOwnProperty(i1)) {
                    let type = AAX.part_properties[i1].type;
                    let _i1 = (type === "no_default" || type === "" || type === "pose_getset" ? "_" : "") + i1;
                    // add back the underscore
                    AAX.nodefaultclone(obj[i1], part, _i1);
                    //pose[i1][i2] = structuredClone(obj[i1][i2]);
                }
            }
            return part;
        }
        get bodyref() {
        // the version of this part in the body.
            return this.body[this.name];
        }
        get partobj() {
        // returns a trimmed-down version of the part, with nothing but the
        // necessary information. (it skips "default"s, and some other
        // properties.)
        // - used in poseobjs.
            let obj = {};
            for(i1 in this) {
                if(this.hasOwnProperty(i1) && !["tool", "body", "pose", "name"].includes(i1)) {
                // no getters, no references
                // - name is redundant too.
                // - the cache is kept, though.
                    AAX.nodefaultclone(this[i1], obj, (i1.startsWith("_") ? i1.slice(1) : i1));
                    // getting rid of the underscore looks better, and makes
                    // sure abscoor and stuff like that still works on it.)
                    //obj[i1] = structuredClone(this[i1]);
                }
            }
            return obj;
        }
        get abscoor() {
            return AAX.abscoor(this.pose, this.name);
        }
        // array of absolute coordinates
        get relcoor() {
            return AAX.relcoor(this);
        }
        // array of relative coordinates
        get oddness() {
            return AAX.oddness(this.pose, this.name);
        }
        // array of booleans for whether the abscoor is a decimal number,
        // for each axis.
        get rel_oddness() {
            return AAX.rel_oddness(this);
        }
        image_oddness(view) {
            return AAX.image_oddness(this.pose, this.name, view);
        }
        dim(view, length) {
        // - length: AAX.dim returns null if the image isn't real, since
        //   otherwise it might run rasterize or something just to get a
        //   single number.
            return AAX.dim(this.pose, this.name, view, length, false);
        }
        size(view, length) {
            return AAX.dim(this.pose, this.name, view, length, true);
        }
        cropsize(view) {
            let temp = ((view === "front" || view === "right") ? "image" : "perspective") + "_" + view;
            return (
                this.isreal(temp)
                ?
                AAX.sq_raster.cropsize(this[temp], this.image_oddness(view))
                :
                null
            );
        }
        get descendants() {
            return AAX.getdesc(this.pose, this.name);
        }
        clearcache(type) {
            AAX.clearcache(this.pose, this.name, type);
        }
        image_string(view) {
        // for testing only. converts the image into a string.
            let i1 = 0;
            if(!["front", "right", 0, 1, 2, 3].includes(view)) {
                console.log("invalid view.");
            };
            const image = this[(
                ["front", "right"].includes(view)
                ?
                "image_" + view
                :
                "perspective_" + view
            )].join("");
            const w = this.dim(view, image.length)[0];
            let text = [];
            for(i1 = 0; i1 < image.length; i1 += w) {
                text[text.length] = image.slice(i1, i1 + w);
            }
            return text.join(String.fromCharCode(10)).replaceAll("0", "-").replaceAll("1", "%").replaceAll("2", "*");
        }
        image_source(view) {
        // returns "shape", "image", or "perspective", for where the image
        // for this view comes from after redirects.
            let temp = (view === "front" || view === "right") ? "image" : "perspective";
            let value = this["_" + temp][view];
            if(value === "default") {
                value = this.bodyref[temp][view];
            };
            if(value === null) {
                if(temp === "image") {
                // null image => get from shape
                    return "shape";
                }
                else if(temp === "perspective") {
                // null perspective => get from unperspectived
                    return this.image_source(view%2 ? "right" : "front");
                }
                else {
                    console.log("this shouldn't happen");
                };
            }
            else {
            // real image
                return temp;
            }
        }
        get(property) {
            let i1 = 0;
            let loop = new Loop("AAX.Part.get");
            if(!AAX.part_properties.hasOwnProperty(property)) {
                console.log("invalid Part.get. (" + property + ") it must a property in AAX.part_properties.");
                return;
            };
            if(
                property === "image_front"
                ||
                property === "image_right"
                ||
                (property.startsWith("perspective_") && ["0", "1", "2", "3"].includes(property.slice("perspective_".length)))
            ) {
            // all images require null redirects and maybe rasterize or
            // image editing, so their logic is separate. redirects, runs
            // change_oddness for differences in image dimensions and
            // xmirror for view 2 and 3
            // - check perspective image
            //   - if it's "default", use body perspective image
            //     - if that's null, use unperspectived image (if it's view
            //       2 or 3, xmirror it.)
            //       - if that's "default", use body unperspectived image
            //         - if that's null, use shape
            //           - if that's "default", use body shape
            // =
            // - basically, null is like a "final value", but all it
            //   means is to start over with the unperspectived, or start
            //   over with the shapes.
            // - but now it's image_source that does all of that.
                let value = this.getwithoutredirects(property);
                if(this.isreal(property)) {
                    return value;
                };
                let temp = property.slice( property.lastIndexOf("_") + 1 );
                const perspectived = temp !== "front" && temp !== "right";
                const view = perspectived ? Number(temp) : temp;
                const source = this.image_source(view);
                const oddness = this.image_oddness(view);
                if(source === "shape") {
                    return this.rasterize(view);
                }
                else if(source === "image") {
                    temp = perspectived ? (view%2 ? "right" : "front") : view;
                }
                else if(source === "perspective") {
                    if(!perspectived) {
                        console.log("this shouldn't happen");
                        return;
                    }
                    temp = view;
                }
                else {
                    console.log("this shouldn't happen");
                    return;
                };
                value = this["_" + source][temp];
                if(value === "default") {
                // it's in the body
                    value = AAX.sq_raster.changeoddness(this.bodyref[source][temp], AAX.image_oddness(this.body, this.name, view), oddness);
                    // fix oddness inconsistency
                };
                if(value === null) {
                    console.log("this shouldn't happen");
                    return;
                };
                // image_source should have navigated through these.
                return (
                    ((view === 2 || view === 3) && source === "image")
                    ?
                    Raster.xmirror(value, AAX.l_dim(value.length, oddness)[0])
                    :
                    structuredClone(value)
                );
            };
            let type = AAX.part_properties[property].type;
            if(type === "pose_exclusive") {
                console.log("there aren't supposed to be getters for pose_exclusive properties.");
                return;
            }
            else if(type === "pose_getset") {
                return this.getwithoutredirects(property);
            };
            let value = {};
            let array = property.split("_");
            // property chain
            let children = AAX.part_properties[property].children;
            if(children.length) {
            // make a collection of the child getters, instead.
                for(i1 = 0; i1 < children.length; i1++) {
                    loop.tick(1);
                    value[children[i1].slice(property.length + 1)] = this[children[i1]];
                };
                loop.end();
                return value;
            };
            let inbody = type === "body_exclusive";
            if(!inbody) {
            // search the pose
                value = this.getwithoutredirects(property);
                if(["ancestor is default", "default"].includes(value)) {
                    inbody = true;
                };
            };
            if(inbody) {
            // search the body
                if(type === "pose_exclusive" || (type === "no_default" && array.length === 1)) {
                // "no_default" is only an error if it had no ancestors that
                // weren't no_default. it would take some complicated logic
                // to make a better error.
                    console.log("this shouldn't happen");
                    return;
                };
                value = this.bodyref;
                for(i1 = 0; i1 < array.length; i1++) {
                    loop.tick(1);
                    value = value[array[i1]];
                }
                loop.end();
                // go through the property chain
            };
            //
            if(["color1", "color2"].includes(property) && typeof value === "number") {
                return (
                    value < 0 || value >= this.tool.color.parts.length
                    ?
                    "gray"
                    :
                    this.tool.color.parts[ value ]
                );
                // the color buttons let you change the length of the color
                // array, so this has to return something even if a number
                // is out of range.
            }
            else if(value === "auto" && property.slice(0, -1) === "perspective_coor_" && ["0", "1", "2", "3"].includes(property.slice(-1))) {
                return this.tool.drawsettings.autoperspective(this.abscoor, Number(property.slice(-1)));
            }
            else {
                return value;
            };
        }
        inbetween(num, relcoor, stretch, widen, orient) {
        // makes itself kind of like another part.
        // - 0: no change
        // - 1: exactly like the target relcoor/stretch/etc
            if(!num || typeof num !== "number") {
                return;
            };
            if(Points.valid(relcoor, 3)) {
                let coorA = this.relcoor;
                let coorB = relcoor;
                let newcoor = null;
                if(this.parent === "standpoint") {
                // forget doing anything smart, just interpolate
                    newcoor = Points.add(
                        coorA,
                        Points.multiply(
                            Points.subtract(coorB, coorA),
                            num
                        )
                    );
                }
                else {
                // interpolate length, and use a quaternion to interpolate
                // angle
                    let length1 = Math.hypot(...coorA);
                    let length2 = Math.hypot(...coorB);
                    let between = length1 && length2 ? Quat.arc(Angle.get(...coorA), Angle.get(...coorB)) : null;
                    if(between) {
                    // skip if the angles are parallel or one of the lengths
                    // is zero.
                        between = Quat.multiply_num(between, num);
                        newcoor = Quat.apply(between, coorA);
                        newcoor = Points.multiply(Points.normalized(newcoor), length1 + num*(length2 - length1));
                        // interpolate length
                    }
                };
                if(newcoor !== null) {
                // coordinates are done, but the oddness has to match.
                // - the coordinate setters round to the nearest .5, that isn't
                //   the issue.
                // - the issue is that i want to avoid oddness changes the user
                //   does not specifically want. even if it makes sense for how
                //   the numbers work out, it means a change in dimensions.
                // - this method makes an inbetween between a start and end
                //   pose, right? so the oddness should work out like:
                //   - if the float is the same in both the start and end pose,
                //     use that.
                //   - otherwise, use the start pose's float if num is in the 0
                //     to .5 range, the end pose's float if it's in the .5 to 1
                //     range
                //   - and if it's exactly .5 and the start/end are different,
                //     leave it up to chance, ie use the float it had when going
                //     strictly by the math.
                    let floats = [];
                    let parent = this.parent === "standpoint" ? [0, 0, 0] : this.pose[this.parent].abscoor;
                    newcoor = Points.add(newcoor, parent);
                    // add parent coordinates at the beginning and subtract them
                    // at the end, since it's the absolute oddness that counts.
                    for(let i1 = 0; i1 < 3; i1++) {
                        let floatA = posmod(parent[i1] + coorA[i1], 1);
                        let floatB = posmod(parent[i1] + coorB[i1], 1);
                        floats[i1] = (
                            (num < .5 || floatA === floatB) ? floatA :
                            num > .5 ? floatB :
                            posmod( Math.trunc(newcoor[i1]*2)/2 , 1)
                            // newcoor hasn't been rounded yet, so do it now
                        );
                    }
                    //newcoor = AAX.fixfloats(newcoor, floats, null, false, "hypot");
                    newcoor = AAX.fixfloats(newcoor, floats);
                    // now bring it to the nearest coordinates that have those
                    // floats.
                    newcoor = Points.subtract(newcoor, parent);
                    this.x = newcoor[0];
                    this.y = newcoor[1];
                    this.z = newcoor[2];
                };
            };
            if(typeof stretch === "number") {
                this.stretch = this.stretch + num*(stretch - this.stretch);
            };
            if(typeof widen === "number") {
                this.widen = this.widen + num*(widen - this.widen);
            };
            if(Quat.valid(orient)) {
                this.orient = Quat.slerp(this.orient, orient, num);
            };
        }
        getwithoutredirects(property, placeandname, bodyref) {
        // put in a AAX.part_properties property, and it'll give you the true
        // value. for a given definition of "true".
        // - it won't do any redirects. not "default", not any of the
        //   others.
        // - it can also return "ancestor is default", which means one of
        //   its ancestors is "default" instead of an object, therefore it
        //   has no real value.
        //   - i'd use null or undefined, but those are both pretty loaded
        //     words.
        // - basically, these property names are kind of a pain to search
        //   through, so i use this.
        // - placeandname: if true, it'll return an array of the object your
        //   property is in, and the property name it's stored under.
        // - bodyref: if true, it'll search the bodyref instead.
            if(!AAX.part_properties.hasOwnProperty(property)) {
                console.log(property + " is not a property name in AAX.part_properties.");
                return;
            };
            if(bodyref && ["pose_exclusive", "pose_getset"].includes(AAX.part_properties[property].type)) {
                console.log("can't search the body for a frame-exclusive property.");
                return;
            };
            let i1 = 0;
            let loop = new Loop("AAX.Part getwithoutredirects");
            let array = property.split("_");
            let value = bodyref ? this.bodyref : this;
            //console.log("---");
            for(i1 = 0; i1 < array.length; i1++) {
            // run through property chains
                loop.tick(1);
                //console.log(array[i1]);
                let name = (!bodyref && i1 === 0 && AAX.part_properties[property].type !== "pose_exclusive" ? "_" : "") + array[i1];
                // adds the underscore
                if(placeandname && i1 === array.length - 1) {
                    return [value, name];
                };
                value = value[name];
                if(value === "default" && i1 !== array.length - 1) {
                    return "ancestor is default";
                }
                else if(typeof value !== "object" && i1 !== array.length - 1) {
                    console.log("this shouldn't happen: " + array + "[" + i1 + "]");
                }
            }
            loop.end();
            return value;
        }
        set(property, value) {
            let i1 = 0;
            let i2 = 0;
            let loop = new Loop("AAX.Part.set");
            if(AAX.part_properties[property].type === "pose_getset") {
            // these are kind of unrelated to the system everything else
            // works on.
                let temp = this.getwithoutredirects(property, true);
                // place and name
                temp[0][ temp[1] ] = value;
            }
            else if(AAX.part_properties[property].type === "body_exclusive") {
                console.log("this value is bound to the default body, it cannot be changed.");
            }
            else if(value === "default" && AAX.part_properties[property].type !== "pose_exclusive") {
                value = structuredClone(this.getwithoutredirects(property, false, true));
                // value in body
                if(value === "default") {
                // unlikely, but it'd cause recursive horseshit
                    console.log(`this shouldn't happen. "default" is a reserved value that means to reference what's in the body, but it's used in the body.`);
                    return;
                };
                this.set(property, value);
                // applies whatever adjustments apply to that property (for
                // example, image adjustments from coordinate oddness
                // changes)
                if(AAX.part_properties[property].type !== "no_default") {
                // makes sure it's "default" instead of the real value that
                // the recursive run set. (like the opposite of makereal, i
                // guess)
                    let temp = this.getwithoutredirects(property, true);
                    temp[0][ temp[1] ] = "default";
                };
            }
            else if(["x", "y", "z"].includes(property)) {
            // if oddness changes...
            // - make sure all childrens' relative coordinates compensate,
            //   with fixfloats run as well
            // - edit all six shapes that aren't default/null
                value *= 2;
                value = Math[posmod(value, 1) === .5 ? "trunc" : "round"](value);
                if(!Number.isInteger(value)) {
                // NaN, Infinity, etc
                    return;
                }
                value /= 2;
                // make sure it's a .0 or .5
                const index = "xyz".indexOf(property);
                const old_oddness = this.oddness[index];
                const new_oddness = !!(((this.parent === "standpoint" ? 0 : this.pose[this.parent].abscoor[index]) + value)%1)
                if(old_oddness === new_oddness) {
                    this["_" + property] = value;
                }
                else {
                    const old_relcoor = this.relcoor;
                    const old_dim = {};
                    for(i1 = -2; i1 < 4; i1++) {
                        loop.tick(1);
                        const view = i1 === -2 ? "front" : i1 === -1 ? "right" : i1;
                        let temp = (i1 < 0 ? "image_" : "perspective_") + view;
                        // property name
                        if(this.isreal(temp)) {
                            old_dim[view] = this.dim(view);
                            //old_dim[view] = this.dim(view, this[temp].length);
                        }
                    }
                    loop.end();
                    // need to know the old w/h to use change_dimensions
                    // later
                    // - and since oddness is a factor, this needs to be
                    //   done before the coordinate change.
                    let changes = {};
                    // stores coordinates changes for all children, to be applied to
                    // them and their descendants.
                    for(i1 in this.pose) {
                        loop.tick(1);
                        if(this.pose.hasOwnProperty(i1) && this.pose[i1].parent === this.name) {
                            let temp = this.pose[i1].relcoor;
                            let _oddify = this.pose[i1].oddify(property);
                            changes[i1] = [
                                roundspecial(_oddify[0] - temp[0]),
                                roundspecial(_oddify[1] - temp[1]),
                                roundspecial(_oddify[2] - temp[2])
                            ];
                            let oddness_check = structuredClone(changes[i1]);
                            oddness_check[index] = roundspecial(oddness_check[index] + value - old_relcoor[index]);
                            oddness_check = [
                                !!(oddness_check[0]%1),
                                !!(oddness_check[1]%1),
                                !!(oddness_check[2]%1)
                            ];
                            // checks to make sure the difference between the old
                            // coordinates and new coordinates is nothing but
                            // integers.
                            // - since the only unmoving element is the main part's
                            //   parent, it also adds the difference between the
                            //   main part's old and new coordinates.
                            if(oddness_check.includes(true)) {
                                console.log("this shouldn't happen");
                                changes[i1][0] = Math.round(changes[i1][0]);
                                changes[i1][1] = Math.round(changes[i1][1]);
                                changes[i1][2] = Math.round(changes[i1][2]);
                            };
                        }
                    }
                    loop.end();
                    // apply an opposite change for the children, so that their
                    // relative coordinates have the same oddness afterwards.
                    this["_" + property] = value;
                    // apply changes to coordinates
                    for(i1 in changes) {
                        loop.tick(1);
                        if(changes.hasOwnProperty(i1)) {
                        // children too. (and descendants by extension, since
                        // coordinates are relative, not absolute.)
                        // - use the underscored version, to bypass all this
                        //   logic. (the setter would assume the image
                        //   starts out right and the coordinates make it
                        //   wrong, but it's the other way around.)
                            let child = this.pose[i1];
                            child._x += changes[i1][0];
                            child._y += changes[i1][1];
                            child._z += changes[i1][2];
                        }
                    }
                    loop.end();
                    const new_box = this.box;
                    for(let view in old_dim) {
                        loop.tick(1);
                        if(old_dim.hasOwnProperty(view)) {
                        // if the image exists, change the dimensions.
                            let temp = (view === "front" || view === "right") ? "image" : "perspective";
                            const size = this.size(view);
                            const oddness = this.image_oddness(view);
                            this["_" + temp][view] = Raster.redimension(
                                this["_" + temp][view],
                                old_dim[view][0],
                                AAX.onedim(size, oddness[0]),
                                AAX.onedim(size, oddness[1])
                            );
                        }
                    }
                    loop.end();
                };
            }
            else if(property.startsWith("perspective_coor_")) {
            // change image oddness
                const view = Number(property.slice("perspective_coor_".length));
                const old_oddness = this.image_oddness(view);
                this._perspective.coor[view] = value;
                if(this.isreal("perspective_" + view)) {
                    this._perspective[view] = AAX.sq_raster.changeoddness(this._perspective[view], old_oddness, this.image_oddness(view));
                };
            }
            else {
                if(
                    (
                        property === "image_front"
                        ||
                        property === "image_right"
                        ||
                        (
                            property.startsWith("perspective_")
                            &&
                            ["0", "1", "2", "3"].includes(property.slice("perspective_".length))
                        )
                    )
                    &&
                    value !== "default" && value !== null
                ) {
                // autocrop
                    let view = property.slice(property.lastIndexOf("_") + 1);
                    view = property.startsWith("perspective_") ? Number(view) : view;
                    value = AAX.sq_raster.autocrop(value, AAX.l_dim(value.length, this.image_oddness(view))[0]);
                }
                let temp = this.getwithoutredirects(property, true);
                temp[0][ temp[1] ] = value;
                // - does pretty much everything that shit like oddify does.
                //   - coordinates (if oddness changes)
                //     - if autoperspective allows oddness, do the same shit
                //       the perspective coordinates setter does.
                //   - perspective coordinates (if oddness changes)
                //     - edit the relevant image, if it's not default/null
                //     =
                //     - make sure to account for auto or default. compare what it was with
                //       what it is
            };
            //
            if(property === "shape") {
            // cache.oriented is obsolete
                this.clearcache("orientedshape");
            }
            else if(["orient", "stretch", "widen"].includes(property)) {
            // cache.oriented is obsolete, but other parts' shapes are also
            // affected if they invoke this part in their .external
                this.clearcache("orientedshape");
                let array = this.shapedependents;
                let pose = this.pose;
                for(let i1 = 0; i1 < array.length; i1++) {
                    loop.tick(1);
                    pose[ array[i1] ].clearcache("orientedshape");
                }
                loop.end();
            }
            else if(["x", "y", "z"].includes(property)) {
                this.clearcache(
                    (this.stretch === 1 && this.widen === 1)
                    ?
                    "rasterize perspective"
                    // perspective views are made obsolete because how the
                    // perspective moves the points depends on where it is
                    // relative to the vanishing point.
                    :
                    "orientedshape"
                    // x/y/z also affects the line that stretch/widen is
                    // done along. but stretch/widen are 1 most of the time,
                    // so avoid this is possible.
                );
            }
            // when the 3d shape is next used, rasterize will recreate
            // cache.oriented with .orientedshape.
        }
        isreal(property) {
        // checks if a property is real, or just some reference value
        // - "default"
        // - null perspective images
        // - NOT color1/color2 numbers or automatic perspective coordinates.
        //   it's not like those are any different, but i consider them
        //   "real".
            let value = this.getwithoutredirects(property);
            return !(
                ["default", "ancestor is default"].includes(value)
                ||
                (
                    value === null
                    &&
                    (
                        property === "image_front"
                        ||
                        property === "image_right"
                        ||
                        (property.slice(0, -1) === "perspective_" && "0123".includes(property.slice(-1)))
                    )
                )
            )
        }
        makereal(property) {
        // if a property is not a real value, (ie it fails this.isreal. it's
        // a "default", or a null perspective image) it will make it real,
        // as a clone of whatever it currently redirects to.
        // - it also runs this method on all of a property's ancestors, to
        //   make sure it doesn't try to add a property to a nonexistent
        //   object.
            let i1 = 0;
            let loop = new Loop("AAX.Part.makereal");
            if(!AAX.part_properties.hasOwnProperty(property)) {
                console.log(property + " is not a property name in AAX.part_properties.");
                return;
            }
            else if(["body_exclusive", "pose_exclusive"].includes(AAX.part_properties[property].type)) {
                console.log("body_exclusive and pose_exclusive properties have no underscored/getter duality.");
                return;
                // it's not like it'd hurt to run this anyway, as long as it
                // exits here. except i guess if perspective views became
                // body_exclusive or pose_exclusive? which they super
                // won't.
            }
            else if(AAX.part_properties[property].type === "pose_getset") {
                console.log("pose_getset properties use getters/setters, but as of writing this message, none of them use a redirect system, so it should always be real.");
                return;
            };
            let ancestor = (
                property.includes("_")
                ?
                property.slice(0, property.indexOf("_"))
                :
                property
            );
            // the first property in the chain.
            let cousins = {};
            for(i1 in AAX.part_properties) {
                loop.tick(1);
                if(AAX.part_properties.hasOwnProperty(i1) && i1.startsWith(ancestor + "_") && i1 !== property && AAX.part_properties[i1].children.length === 0) {
                // store all irrelevant getwithoutredirects, so they can be
                // restored.
                    cousins[i1] = structuredClone(this.getwithoutredirects(i1));
                    // the value, without redirects.
                    if(cousins[i1] === "ancestor is default") {
                    // shrug emoticon
                    // - i'm not sure if this is possible without redirects
                    //   that can be children of redirects, so i'm not gonna
                    //   fuss about it yet.
                        delete cousins[i1];
                    };
                }
            }
            loop.end();
            this["_" + ancestor] = structuredClone(this[ancestor]);
            for(i1 in cousins) {
                loop.tick(1);
                if (cousins.hasOwnProperty(i1)) {
                    let place = this.getwithoutredirects(i1, true);
                    // place and name
                    place[0][ place[1] ] = structuredClone(cousins[i1]);
                }
            }
            loop.end();
            // it needed a lot less recursion than i thought it would. since
            // since the getter of the great-grandparent or whatever will
            // return an object of references, which will all get
            // structuredClone-d.
            // - and all that a structuredClone-ing of a getter does is get
            //   rid of redirects. real values will just clone themselves,
            //   so there's no change.
        }
        get orientparts() {
        // an array of part names, matching the .shape_points. for each
        // point, there's a string for which part's stretch/widen/orient it
        // should use.
        // - returns "skip" if there are no externals. that will be true
        //   most of the time, so oriented shape takes a shortcut.
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            let loop = new Loop("AAX.Part.orientparts");
            if(!this.shape) {
                console.log("this shouldn't happen");
                return;
            };
            let shape = this.shape;
            if(objectisempty(shape.external.groups) && objectisempty(shape.external.points)) {
                return "skip";
            };
            let array = [];
            for(i1 = 0; i1 < shape.points.length; i1++) {
                loop.tick(1);
                array[i1] = [];
                for(i2 = 0; i2 < shape.points[i1].length; i2++) {
                    loop.tick(2);
                    array[i1][i2] = this.name;
                }
                loop.end();
            }
            loop.end();
            // start with all of them following the main part
            let pose = this.pose;
            let ref = shape.external.groups;
            for(i1 in ref) {
                loop.tick(1);
                if(ref.hasOwnProperty(i1) && pose.hasOwnProperty(i1) && i1 !== this.name) {
                // for each external part
                    for(i2 = 0; i2 < ref[i1].length; i2++) {
                    // for each group named in that external part...
                        loop.tick(2);
                        let ref2 = array[ ref[i1][i2] ];
                        for(i3 = 0; i3 < ref2.length; i3++) {
                        // for each point in that group...
                            loop.tick(3);
                            ref2[i3] = i1;
                        }
                        loop.end();
                    }
                    loop.end();
                };
            }
            loop.end();
            ref = shape.external.points;
            for(i1 in ref) {
                loop.tick(1);
                if(ref.hasOwnProperty(i1) && pose.hasOwnProperty(i1) && i1 !== this.name) {
                // for each external part
                    for(i2 = 0; i2 < ref[i1].length; i2++) {
                    // for each point that part claims
                        loop.tick(2);
                        let temp = AAX.points_linear_index(points, ref[i1][i2]);
                        // the indexes are linear, so
                        array[ temp[0] ][ temp[1] ] = i1;
                    }
                    loop.end();
                };
            }
            loop.end();
            // now it's a perfect matching array for which part's
            // stretch/widen/orient to use for each point.
            return array;
        }
        get shapedependents() {
        // returns an array of parts that use this part in their .external.
        // all of these parts have to have their cache.oriented cleared if
        // this part's orient/stretch/widen changes.
            let array = [];
            let pose = this.pose;
            let name = this.name;
            let loop = new Loop("AAX.Part.shapedependents");
            for(let i1 in pose) {
                loop.tick(1);
                if(
                    pose.hasOwnProperty(i1) && i1 !== name
                    &&
                    (
                        (
                            pose[i1].shape.external.points.hasOwnProperty(name)
                            &&
                            pose[i1].shape.external.points[name].length
                        )
                        ||
                        (
                            pose[i1].shape.external.groups.hasOwnProperty(name)
                            &&
                            pose[i1].shape.external.groups[name].length
                        )
                    )
                ) {
                    array[array.length] = i1;
                }
            }
            loop.end();
            return array;
        }
        get orientedshape() {
        // returns the shape.points, after orienting the points/groups/etc
        // according to the relevant parts' stretch/widen/orient.
            let i1 = 0;
            let i2 = 0;
            let loop = new Loop("AAX.Part.orientedshape");
            let orientparts = this.orientparts;
            let shape = this.shape;
            let points = structuredClone(shape.points);
            // - groups separated by breaks (each of these is drawn
            //   separately, so that it can make concave features)
            //   - points
            //     - coordinates, and maybe dimensions and orient
            function getline(part) {
            // returns the Line that stretch/widen is applied along, or null
            // if not applicable.
                //let line = AAX.relcoor(part.bodyref);
                let line = part.relcoor;
                line = (
                    part.parent !== "standpoint" && (line[0] || line[1] || line[2])
                    ?
                    new Line(0, 0, 0, Angle.get(...line))
                    :
                    null
                );
                return line;
            }
            function applyedits(point, stretch, widen, line, basis, quat) {
            // applies scaling/orientation
                let _point = structuredClone(point.slice(0, 3));
                if(line) {
                    _point = line.stretch_widen(_point, stretch, widen);
                }
                else {
                // stretch/widen not applicable because the angle is invalid
                    _point[0] *= widen;
                    _point[1] *= widen;
                    _point[2] *= widen;
                };
                // scale
                _point = apply_basis(basis, _point).concat(point.slice(3));
                // orient coordinates
                if(_point.length >= 6) {
                // orient orient. (apply view rotation, part orientation.)
                    _point[6] ??= Quat.new();
                    _point[6] = Quat.local_multiply(quat, _point[6])
                    // start with view rotation, modify by part .orient,
                    // modify by spheroid orient
                    //_point[6] = Quat.multiply(_point[6], quat);
                    //_point[6] = Quat.rotate(_point[6], "xz", view*Math.PI/2);
                }
                return _point;
            };
            if(orientparts === "skip") {
            // means there's no externals. every point should follow the
            // main part's orient/etc.
                const basis = Quat.basis(this.orient);
                const stretch = this.stretch;
                const widen = this.widen;
                const line = getline(this);
                for(i1 = 0; i1 < points.length; i1++) {
                    loop.tick(1);
                    for(i2 = 0; i2 < points[i1].length; i2++) {
                        loop.tick(2);
                        points[i1][i2] = applyedits(points[i1][i2], stretch, widen, line, basis, this.orient);
                    }
                    loop.end();
                }
                loop.end();
                return points;
            };
            //
            const pose = this.pose;
            //
            const basis = {};
            const stretch = {};
            const widen = {};
            const line = {};
            const orient = {};
            for(i1 = 0; i1 < points.length; i1++) {
                loop.tick(1);
                for(i2 = 0; i2 < points[i1].length; i2++) {
                    loop.tick(2);
                    let ext_name = orientparts[i1][i2];
                    let ext = pose[ext_name];
                    //
                    orient[ext_name] ??= ext.orient;
                    basis[ext_name] ??= Quat.basis(orient[ext_name]);
                    stretch[ext_name] ??= ext.stretch;
                    widen[ext_name] ??= ext.widen;
                    if(!line.hasOwnProperty(ext_name)) {
                        line[ext_name] = getline(ext);
                    };
                    // create these if they don't exist (line is different
                    // because null is an accepted value.)
                    points[i1][i2] = applyedits(points[i1][i2], stretch[ext_name], widen[ext_name], line[ext_name], basis[ext_name], orient[ext_name]);
                }
                loop.end();
            }
            loop.end();
            return points;
        }
        rasterize(view) {
        // creates the specified image from the .shape.
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            let loop = new Loop("AAX.Part.rasterize");
            //console.log(this.name, view);
            let drawsettings = this.tool.drawsettings;
            let hide2 = (image) => (
                drawsettings.vertices
                ?
                image
                :
                Raster.rewrite(image, (value) => value === 2 ? 1 : value)
            );
            // hides 2 pixels if drawsettings.vertices is off.
            let oddness = this.image_oddness(view);
            if(this.cache.rasterize[view]) {
            // recycle from the cache whenever possible. hide 2 pixels,
            // adjust for oddness changes.
                return hide2( AAX.sq_raster.changeoddness(this.cache.rasterize[view].image, this.cache.rasterize[view].oddness, oddness) );
            }
            const perspectived = [0, 1, 2, 3].includes(view);
            const _view = view;
            view = view === "front" ? 0 : view === "right" ? 1 : view;
            let xz = view*Math.PI/2;
            let yz = 0;
            if(perspectived) {
                xz += drawsettings.camera.xz;
                yz += drawsettings.camera.yz;
                xz = posmod(xz, 2*Math.PI);
            }
            //orientedshape ??= this.orientedshape;
            //let points = revolve(view*Math.PI/2, orientedshape, null, "xz");
            this.cache.oriented ??= this.orientedshape;
            let points = structuredClone(this.cache.oriented);
            for(i1 = 0; i1 < points.length; i1++) {
            // apply view/camera rotation
                //let viewer = this.tool.drawsettings.viewer;
                //let sizemod = AAX.camerarotations(this.abscoor, view, xz, yz)[2];
                //sizemod = viewer.z_size(viewer.central_z + sizemod);
                //
                points[i1] = revolve(xz, points[i1], null, "xz");
                points[i1] = revolve(yz, points[i1], null, "yz");
                for(i2 = 0; i2 < points[i1].length; i2++) {
                    let ref = points[i1][i2];
                    //for(i3 = 0; i3 < ref.length && i3 < 6; i3++) {
                    //    ref[i3] *= sizemod;
                    //}
                    if(ref.length > 4) {
                    // and don't forget to rotate spheroids too.
                        ref[5] ??= ref[3];
                        ref[6] ??= Quat.new();
                        ref[6] = Quat.rotate(ref[6], "xz", xz);
                        ref[6] = Quat.rotate(ref[6], "yz", yz);
                    }
                }
            }
            const abscoor = revolve(view*Math.PI/2, this.abscoor, null, "xz");
            // rotated absolute coordinates
            let temp = this["perspective_coor_" + view];
            const _abscoor = [
                abscoor[0] + temp[0],
                abscoor[1] + temp[1],
                abscoor[2] + (perspectived ? drawsettings.viewer.central_z : 0)
            ];
            // version with the same floats as abscoor + perspective_coor
            let data = Raster.from3d(points, drawsettings.fineness ? drawsettings.fineness : 32, _abscoor, perspectived ? drawsettings.viewer : null, "aa");
            // within and rect that these shapes cover.
            //console.log(data.rect);
            if(!data.raster.length) {
                //console.log(this.name, _view, data);
                let array = [];
                let temp = AAX.onedim(0, oddness[0])*AAX.onedim(0, oddness[1]);
                for(i1 = 0; i1 < temp; i1++) {
                    array[i1] = 0;
                }
                this.cache.rasterize[_view] = {oddness, image: structuredClone(array)};
                //console.log(Points.add(_abscoor, aa.box(AAX.l_size(array.length, oddness), oddness)));
            }
            else {
                if(data.rect.x%1 || data.rect.y%1) {
                    console.log("oops");
                }
                /*
                data.rect.x += Math.sign(data.rect.w)/2;
                data.rect.y += Math.sign(data.rect.h)/2;
                data.rect.w -= Math.sign(data.rect.w);
                data.rect.h -= Math.sign(data.rect.h);
                data = AAX.sq_raster.squarify(data.raster, data.rect);
                //*/
                let adjustment = [
                    Math.trunc(data.rect.x + data.rect.w/2),
                    Math.trunc(data.rect.y + data.rect.h/2)
                ];
                // save this, so it can be used later
                //console.log(Raster.totext(data.raster, data.rect.w));
                if(data.rect.w !== data.rect.h) {
                // aa rasters have to be squarish
                    let temp = Math.abs(data.rect.w - data.rect.h);
                    temp = Math.floor(temp/2)*2;
                    let old_w = data.rect.w;
                    if(data.rect.w < data.rect.h) {
                        data.rect.w += temp;
                    }
                    else if(data.rect.w > data.rect.h) {
                        data.rect.h += temp;
                    }
                    else if(data.rect.w !== data.rect.h) {
                    // dimensions are probably NaN or something
                        console.log("this shouldn't happen");
                    };
                    data.raster = Raster.redimension(data.raster, old_w, data.rect.w, data.rect.h);
                };
                let _oddness = [null, null];
                for(i1 = 0; i1 < 2; i1++) {
                    let temp = AAX.onedim(0, !!i1);
                    if(data.rect.w%2 === temp) {
                        _oddness[0] = !!i1;
                    };
                    if(data.rect.h%2 === temp) {
                        _oddness[1] = !!i1;
                    };
                }
                if(_oddness[0] === null || _oddness[1] === null) {
                    console.log("this shouldn't happen");
                }
                data.raster = AAX.sq_raster.changeoddness(data.raster, _oddness, oddness);
                // it has to match the part's oddness, since Raster.from3d
                // doesn't think about that
                delete data.rect;
                if(adjustment[0] || adjustment[1]) {
                // move the part to show offset (like if the shape is 8
                // above the actual part... all the code up until now has
                // only been focused on dimensions, so it'll just look
                // centered.)
                    adjustment[0] *= 2;
                    adjustment[1] *= 2;
                    // since adding rows/columns also adjusts where the
                    // center is, you have to add twice as many. it's easier
                    // to understand with a visual.
                    let l = adjustment[0] > 0 ? adjustment[0] : 0;
                    let r = adjustment[0] < 0 ? -adjustment[0] : 0;
                    let u = adjustment[1] > 0 ? adjustment[1] : 0;
                    let d = adjustment[1] < 0 ? -adjustment[1] : 0;
                    let diff = Math.abs(adjustment[0]) - Math.abs(adjustment[1]);
                    let sign = Math.sign(diff);
                    diff = Math.abs(diff)/2;
                    if(sign === -1) {
                    // y added more lines, so add more x lines to keep the
                    // proportions even.
                        l += diff;
                        r += diff;
                    }
                    else if(sign === 1) {
                    // x added more, so add y
                        u += diff;
                        d += diff;
                    }
                    else if(sign !== 0) {
                        console.log("this shouldn't happen");
                    }
                    let w = AAX.l_dim(data.raster.length, oddness)[0];
                    data.raster = Raster.addrowcol(data.raster, w, l, r, u, d);
                }
                //console.log(Raster.totext(data.raster, AAX.l_dim(data.raster.length, oddness)[0]));
                this.cache.rasterize[_view] = {oddness, image: structuredClone(data.raster)};
                // correct the oddness, save it to cache
                // - from3d doesn't care about coordinate oddness, the
                //   floats are always zero. so it should be equivalent to a
                //   [false, false] oddness... except, it uses a traditional
                //   rectangle instead of the thing where size is the number
                //   of positions, so invert it.
                //console.log(this.image_string(_view));
            };
            return hide2(this.cache.rasterize[_view].image);
        }
        get silhouettelist() {
        // list of parts to include in their portion of the silhouette
            let conn = this.connection;
            let list = [this.name];
            // self
            if(conn.type === "generation") {
                if(conn.value[0] > 0) {
                    list = list.concat(AAX.getanc(this.pose, this.name).slice(-conn.value[0]));
                };
                // ancestors
                if(conn.value[1] > 0) {
                    list = list.concat(AAX.getdesc(this.pose, this.name, conn.value[1]));
                };
                // descendants
            }
            return list;
        }
        oddify(axis, hypot) {
        // returns new relative coordinates, where the specified axis is
        // changed from a .0 to a .5 or vice versa.
        // - it looks for whatever coordinates have the ideal floats, have a
        //   hypotenuse close to the bodyref's, and are close to the
        //   original angle of the part.
        //   - unless if this.tool has a property or getter called
        //     "oddify_deform" that's truthy. then it'll just change the one
        //     coordinate and do nothing else.
        // - hypot: if null, it'll use the bodyref to figure this out.
            if(!["x", "y", "z"].includes(axis)) {
                console.log("this shouldn't happen");
                return;
            };
            if((this.tool.oddify_deform ?? false) || this.parent === "standpoint") {
            // in that case, who gives a shit about hypotenuse
                //let coor = this.rel_oddness["xyz".indexOf(axis)] ? Math[subtract ? "ceil" : "floor"](this[axis]) : this[axis] + (subtract ? -1 : 1)/2;
                let coor = Math.floor(this[axis]);
                coor += !(this[axis] - coor)/2;
                let array = this.relcoor;
                array["xyz".indexOf(axis)] = coor;
                return array;
            };
            axis = "xyz".indexOf(axis);
            let axisA = [0, 1, 2];
            axisA.splice(axisA.indexOf(axis), 1);
            let axisB = axisA[1];
            axisA = axisA[0];
            hypot ??= AAX.hypot(this.body, this.pose, this.name, true);
            //
            let oddness = this.rel_oddness;
            let float = [];
            float[axis] = !oddness[axis] * .5;
            // this is the axis we're changing the oddness of, so.
            float[axisA] = oddness[axisA] * .5;
            float[axisB] = oddness[axisB] * .5;
            //console.log(float);
            return AAX.fixfloats(this.relcoor, float, hypot, false, "hypot");
        }
    },
    newpose: function(tool, body) {
    // this returns a blank pose where everything is the same as it is in the
    // body.
        let i1 = 0;
        let i2 = 0;
        let pose = {};
        let loop = new Loop("AAX.newpose");
        for(i1 in body) {
            loop.tick(1);
            if (body.hasOwnProperty(i1)) {
            // run for each part
                pose[i1] = new AAX.Part(tool, body, pose, i1);
            }
        }
        loop.end();
        return pose;
    },
    poseclone: (tool, body, pose) => AAX.posefromobj(tool, body, AAX.poseobj(pose)),
    // makes a duplicate of the specified pose.
    poseobj: function(pose) {
    // used in poseclone, and states in general. a collection of Part.partobjs,
    // a trimmed-down version of a pose. used to store poses that aren't
    // currently loaded, and for save data.
        let i1 = 0;
        let i2 = 0;
        let loop = new Loop("AAX.poseobj");
        let obj = {};
        for(i1 in pose) {
            loop.tick(1);
            if(pose.hasOwnProperty(i1)) {
                obj[i1] = pose[i1].partobj;
            }
            loop.end();
        }
        return obj;
    },
    posefromobj: function(tool, body, obj) {
    // converts poseobjs back to a pose.
    // - NOTE: for it to be identical to what it was made from, the body of then
    //   and now have to be the same.
    //   - it doesn't do any adjustments for applying the pose to a different
    //     body. it'll probably just look wrong, and have some issues depending
    //     on the discrepancies.
        let pose = {};
        for(let i1 in obj) {
            if(obj.hasOwnProperty(i1)) {
                pose[i1] = AAX.Part.fromobj(tool, body, pose, i1, obj[i1]);
            }
        }
        return pose;
    },
    // poseclone: (tool, body, pose) => AAX.posefromobj(tool, body, AAX.poseobj(pose)),
    bodychange: function(tool, body, pose, oldcoor) {
    // makes adjustments for a change in the Body a pose is based on.
    // - body should be the new body.
    // - oldcoor: an AAX.all_rel object made from the old body.
        let i1 = 0;
        let i2 = 0;
        let temp = AAX.poseobj(pose);
        let _pose = AAX.poseobj(AAX.newpose(tool, body));
        for(i1 in temp) {
            if(temp.hasOwnProperty(i1) && _pose.hasOwnProperty(i1)) {
                _pose[i1] = structuredClone(temp[i1]);
            }
        }
        _pose = AAX.posefromobj(tool, body, _pose);
        // this looks like it's doing nothing, but it isn't. this accounts for
        // the old and new body having different parts. it starts from a blank
        // pose and only copies the parts that exist in both.
        let order = AAX.getdesc(_pose);
        for(i1 = 0; i1 < order.length; i1++) {
            let _i1 = order[i1];
            let part = _pose[_i1];
            part.cache = structuredClone(AAX.cache_init);
            // reset the cache entirely, since it doesn't have the same
            // shapes or anything
            if(oldcoor.hasOwnProperty(_i1) && _pose[_i1].parent !== "standpoint") {
                // apply changes to the coordinates. try to
                // emulate the same change between the old
                // default coordinates and the old pose's
                // coordinates.
                // - the standpoint child's coordinates represent
                //   the coordinates of the body in general, so
                //   don't change it.
                let change = Points.change(oldcoor[_i1], part.relcoor);
                // multiplier and quaternion representing how to
                // get from the old default pose's coordinates
                // to the posed coordinates
                let newcoor = Points.applychange(AAX.relcoor(body[_i1]), change.multiplier, change.quat);
                // old body + change = old pose
                // new body + change = new pose
                if(true) {
                // but it should also make adjustments for oddness, so there
                // aren't unexpected changes.
                // - if the pose's oddness matches the old body's oddness, it
                //   should still match.
                // - if it didn't, it shouldn't.
                    let floats = [];
                    let parent = part.parent === "standpoint" ? [0, 0, 0] : _pose[part.parent].abscoor;
                    newcoor = Points.add(newcoor, parent);
                    // it's absolute oddness that matters, so add this at the
                    // beginning and subtract it at the end.
                    let oldbodyabs = [0, 0, 0];
                    let anc = AAX.getanc(_pose, _i1);
                    // figure out which axes had different oddness than the body
                    // before the body changed.
                    anc[anc.length] = _i1;
                    for(i2 = 0; i2 < anc.length; i2++) {
                        oldbodyabs = Points.add(oldbodyabs, oldcoor[ anc[i2] ] ?? [0, 0, 0]);
                        // get the absolute coordinates of the old body.
                        // - oldcoor[ anc[i2] ] might not exist if it's a part
                        //   that's in the new body but not the old.
                    }
                    for(i2 = 0; i2 < 3; i2++) {
                        let axis = "xyz"[i2];
                        let odd = !!((body[_i1][ "xyz"[i2] ])%1);
                        // copy the current body's oddness
                        if(!!(oldbodyabs[_i1]%1) !== !!(_pose[_i1].abscoor[i2]%1)) {
                        // unless if the old coordinates' oddness didn't match
                        // the old body's oddness.
                            odd = !odd;
                        };
                        floats[i2] = Number(odd)/2;
                    }
                    //newcoor = AAX.fixfloats(newcoor, floats, null, false, "hypot");
                    newcoor = AAX.fixfloats(newcoor, floats);
                    // now bring it to the nearest coordinates that have those
                    // floats.
                    newcoor = Points.subtract(newcoor, parent);
                }
                part.x = newcoor[0];
                part.y = newcoor[1];
                part.z = newcoor[2];
                // coordinate setter makes sure these are .0/.5
            }
        }
        return _pose;
    },
    inbetweening: function(tool, body, frames, currframe, values, apply) {
    // uses AAX.Part.inbetween on an array of poses.
    // - tool, body: passed on to poseclone
    // - frames: array of poses (modified directly. it doesn't return a modified
    //   copy.)
    // - currframe: index of the start pose
    // - values: array of 0 to 1 numbers. also indicates where the end pose is.
    //   - a number close to 0 means a pose mostly like the start pose. a number
    //     close to 1 means a pose mostly like the end pose.
    // - apply:
    //   - if false, it creates poses between currframe and the frame after it.
    //   - if true, the [values.length] poses right after currframe will be
    //     tweened, and the end pose will be currframe + values.length + 1.
    // - NOTE: if a part is hidden in the starting pose, it is not tweened at
    //   all.
        let i1 = 0;
        let i2 = 0;
        let next = {};
        // indexed by part names. every property is an array of
        // arguments for AAX.inbetween.
        let currpose = frames[currframe];
        let nextpose = frames[(currframe + (apply ? values.length + 1 : 1))%frames.length];
        for(i1 in nextpose) {
            if(nextpose.hasOwnProperty(i1)) {
                let part = nextpose[i1];
                next[i1] = [
                    part.relcoor,
                    part.stretch,
                    part.widen,
                    structuredClone(part.orient)
                ];
            }
        }
        //let values = aa.inbetweenvalues(ref.number, ref.curve, ref.easeA, ref.easeB);
        for(i1 = 0; i1 < values.length; i1++) {
            // use the .inbetween method to interpolate length,
            // angle, stretch/widen, and orient
            let pose = currframe + i1 + 1;
            if(apply) {
                pose = posmod(pose, frames.length);
            }
            else {
            // splice them in after the current frame
                frames.splice(pose, 0, AAX.poseclone(tool, body, currpose));
            }
            pose = frames[pose];
            let order = AAX.getdesc(pose);
            for(i2 = 0; i2 < order.length; i2++) {
                let part = pose[ order[i2] ];
                let _part = currpose[ order[i2] ];
                if(!_part.hide) {
                // only inbetween unhidden parts
                    if(apply) {
                    // copy the properties of the starting pose
                    // before you inbetween it
                        part.x = _part.x;
                        part.y = _part.y;
                        part.z = _part.z;
                        part.stretch = _part.stretch;
                        part.widen = _part.widen;
                        part.orient = structuredClone(_part.orient);
                    }
                    part.inbetween(values[i1], ...next[ order[i2] ]);
                }
            }
        }
    },
    nodefaultclone: function(value, target, propertyname) {
    // sort of like structuredClone, except it skips anything that's
    // "default". (also it doesn't retain whether it's an array, but this is
    // only used like twice)
    // - value: what you're copying
    // - target, propertyname: you're asking to copy it to
    //   target[propertyname].
        if(value === "default") {
            return;
        }
        else if(typeof value === "object" && value) {
        // create an object in target[propertyname] or add to an existing
        // object in target[propertyname].
            if(Array.isArray(value)) {
                target[propertyname] = [];
                for(let i1 = 0; i1 < value.length; i1++) {
                    AAX.nodefaultclone(value[i1], target[propertyname], i1);
                }
            }
            else {
                let startedempty = false;
                if(typeof target[propertyname] === "object" && target[propertyname]) {
                    startedempty = objectisempty(target[propertyname]);
                }
                else {
                    target[propertyname] = {};
                }
                for(let i1 in value) {
                    if(value.hasOwnProperty(i1)) {
                        AAX.nodefaultclone(value[i1], target[propertyname], i1);
                    }
                }
                if(objectisempty(target[propertyname]) && !startedempty) {
                    delete target[propertyname];
                }
                // skip it if it's an object of nothing but defaults.
            }
        }
        else {
            target[propertyname] = structuredClone(value);
        }
    },
    sq_raster: {
    // Raster has most of the functions used for images, but these ones are
    // specialized for rasters that are always squarish.
    // - the format of an image is a long array of each pixel, left to
    //   right, top to bottom. you need the w number to know how long the
    //   rows are.
    // - each index is a number value of 0, 1, or 2. 0 is transparent, 1 is
    //   the part's color1, 2 is the part's color2.
    //   - plus there's the .fill function, which replaces some 1 pixels
    //     with "fill". but that's never stored permanently. it represents
    //     an interior 1 pixel.
        fill: function(_this, w) {
        // makes color1 just an outline. if a 1 value isn't on the edges and
        // every cardinal neighbor is 1 or 2, it'll be turned into "fill",
        // ie the fill color.
            let i1 = 0;
            let outline = Raster.outline(_this, w);
            let __this = structuredClone(_this);
            for(i1 = 0; i1 < __this.length; i1++) {
                if(__this[i1] === 1 && !outline[i1]) {
                    __this[i1] = "fill";
                };
            }
            return __this;
        },
        cropsize: function(_this, oddness, rotate) {
        // returns the size number it should be cropped to to keep all the
        // 1-2 pixels within bounds.
        // - rotate: if true, the size will be big enough to rotate freely.
            if(!Array.isArray(oddness) || oddness.length !== 2) {
                console.log("oddness should be two booleans corresponding to the raster x and raster y.");
            };
            //console.log([_this.length, oddness]);
            const rect = Raster.dimrect(...AAX.l_dim(_this.length, oddness));
            // indextocoord will do this, but there's no sense having it
            // make a new rect every time.
            let edge = [oddness[0] ? .5 : 0, oddness[1] ? .5 : 0];
            if(rotate) {
                edge = Math.hypot(...edge);
            }
            let indextocoord = (index) => Raster.indextocoord(index, rect);
            for(let i1 = 0; i1 < _this.length; i1++) {
                if(_this[i1]) {
                // ignore 0 pixels
                    let temp = indextocoord(i1);
                    edge = (
                        rotate
                        ?
                        Math.max(edge, Math.hypot(...temp))
                        :
                        [
                            Math.max(edge[0], Math.abs(temp[0])),
                            Math.max(edge[1], Math.abs(temp[1])),
                        ]
                    );
                }
            }
            let target = (
                rotate
                ?
                2*Math.ceil(edge) + 1
                // both dimensions must be this wide or bigger.
                :
                2*Math.round(Math.max(...edge)) + 1
                // the axis of the bigger edge index must be this wide
                // or bigger.
            );
            let axis = rotate ? null : Number(edge[1] > edge[0]);
            for(let size = target - 1; size <= target; size++) {
            // dimensions are either size or size + 1, so temp - 1 could
            // be the correct size.
                if(rotate) {
                    if(Math.min(AAX.onedim(size, oddness[0]), AAX.onedim(size, oddness[1])) >= target) {
                        return size;
                    };
                }
                else if(AAX.onedim(size, oddness[axis]) >= target) {
                    return size;
                }
            }
            console.log("this shouldn't happen");
            // onedim probably didn't work how i expected, produced
            // something other than size or size + 1.
            return null;
        },
        autocrop: (_this, oddness) => AAX.sq_raster.changesize(_this, oddness, AAX.sq_raster.cropsize(_this, oddness)),
        // uses cropsize and changesize to crop it to the exact size needed
        // to fit everything.
        changesize: function(_this, oddness, new_size) {
            if(!Array.isArray(oddness) || oddness.length !== 2) {
                console.log("oddness should be two booleans corresponding to the raster x and raster y.");
            };
            return Raster.redimension(
                _this,
                AAX.l_dim(_this.length, oddness)[0],
                AAX.onedim(new_size, oddness[0]),
                AAX.onedim(new_size, oddness[1])
            );
        },
        changeoddness: function(_this, old_oddness, new_oddness) {
            if(
                !Array.isArray(old_oddness) || old_oddness.length !== 2
                ||
                !Array.isArray(new_oddness) || new_oddness.length !== 2
            ) {
                console.log("oddness should be two booleans corresponding to the raster x and raster y.");
            };
            if(old_oddness[0] === new_oddness[0] && old_oddness[1] === new_oddness[1]) {
                return structuredClone(_this);
            };
            let size = AAX.l_size(_this.length, old_oddness);
            return Raster.redimension(
                _this,
                AAX.onedim(size, old_oddness[0]),
                AAX.onedim(size, new_oddness[0]),
                AAX.onedim(size, new_oddness[1])
            );
        },
        squarify: function(_this, rect) {
        // makes a squarish raster from the specified raster and rectangle.
        // - the rectangle defines what coordinates each index translates
        //   to.
        //   - it can be a single w number or an array of [w, h]
            if(typeof rect === "number") {
                rect = [rect, Math.ceil(_this.length/rect)];
            };
            if(Array.isArray(rect)) {
                rect = Raster.dimrect(...rect);
            };
            let oddness = [
                !!roundspecial(rect.x%1),
                !!roundspecial(rect.y%1)
            ];
            let target = [
                Math.max(
                    Math.abs(rect.x),
                    Math.abs(rect.x + rect.w - Math.sign(rect.w))
                ),
                Math.max(
                    Math.abs(rect.y),
                    Math.abs(rect.y + rect.h - Math.sign(rect.h))
                )
            ];
            let axis = Number(target[1] > target[0]);
            //target = 2*Math.round(Math.max(...target)) + 1;
            target = Math.round(2*Math.max(...target)) + 1;
            // the dimension at [axis] must be this wide or bigger.
            //console.log(target);
            let size = null;
            for(let _size = target - 1; _size <= target && size === null; _size++) {
            // dimensions are either size or size + 1, so temp - 1 could
            // be the correct size.
                if(AAX.onedim(_size, oddness[axis]) >= target) {
                    size = _size;
                }
            }
            if(size === null) {
                console.log("this shouldn't happen");
                // onedim probably didn't work how i expected, produced
                // something other than size or size + 1.
                return null;
            };
            const _rect = Raster.dimrect(
                AAX.onedim(size, oddness[0]),
                AAX.onedim(size, oddness[1])
            );
            let __this = [];
            for(let i1 = 0; i1 < _rect.w*_rect.h; i1++) {
                __this[i1] = 0;
            }
            // make a square raster big enough to contain the previous
            // rectangle
            let indextocoord = (index) => Raster.indextocoord(index, rect);
            // converts indexes in the original rect
            for(let i1 = 0; i1 < _this.length; i1++) {
            // paste what was in the smaller rectangle into the new empty
            // square
                if(_this[i1]) {
                    let temp = indextocoord(i1);
                    temp[0] -= _rect.x;
                    temp[1] -= _rect.y;
                    // make it relative to the new rectangle
                    if(
                        temp[0] < 0 || temp[0] >= _rect.w
                        ||
                        temp[1] < 0 || temp[1] >= _rect.h
                    ) {
                    // means the square isn't big enough
                        console.log("this shouldn't happen");
                    }
                    else {
                        __this[ _rect.w*temp[1] + temp[0] ] = Number(_this[i1]);
                    };
                }
            }
            return AAX.sq_raster.autocrop(__this, oddness);
        },
    },
    DrawSettings: class {
    // every tool that draws armatures has an object like this, storing options
    // for how to draw things.
        constructor() {
            Object.assign(this, AAX.DrawSettings.template);
        }
        static template = {
        // used in the constructor, and when checking if a property name is
        // valid
            cell: {
                w: 6*8,
                h: 9*8,
            },
            grid: [4, 4, 0],
            // like how it works in face3d, each number is a multiplier of the
            // previous. except for 0, that's special. [4, 4, 0] means "draw
            // lines every 4 pixels, every 4*4 pixels, and at the standpoint."
            standpoint: {
                x: 0,
                y: 3*8,
            },
            // the coordinates relative to the top left corner of the cell.
            // - these are relative to the center of the cell. .initialize will
            //   correct that.
            vp: {
                x: 0,
                y: 0,
            },
            // vanishing point
            ratio: 4/5,
            camera: {
                xz: 0,//2*Math.PI/8,
                yz: 0,
            },
            // xz/yz rotation, the viewer/vanishing point autoperspective will
            // use
            fineness: 32,
            // the level of detail for the spheroids
            background: "grid",
            // "gridless": fill the image, tint the side views
            // "grid": draw a grid too
            // "blank": leave the background transparent
            silhouette: "off",
            //silhouette: "overlap",
            parts: "on",
            //parts: "off",
            // "off", "on", or "overlap"
            // - for parts, overlap means all part outlines are drawn, even if
            //   other parts' fill covers them. first is draws all parts' fill,
            //   then it draws all parts' outlines.
            // - for silhouette, it means silhouette groups will actually be
            //   shown. it's kind of a clusterfuck, and you only need it when
            //   you need to know where a certain outline is, so by default it
            //   just acts like all parts are part of group 0.
            skeleton: true,
            perspective: false,
            nodes: true,
            // booleans for which of these should be drawn.
            // - perspective is lines between the perspectived and
            //   unperspectived position
            total_hide: true,
            // even if a part is hidden, nodes still draw. skeleton will also be
            // drawn if there's visible descendants. if this is on, nothing will
            // draw for hidden parts no matter what.
            vertices: true,
            // if true, the points that make up a .shape will be drawn by
            // Part.rasterize as 2 pixels. that can get kinda ugly depending on
            // the angle.
        }
        get viewer() {
            return new Viewer(
                this.ratio,
                this.vp.x - this.standpoint.x,
                this.vp.y - this.standpoint.y,
                // since the coordinates autoperspective converts are
                // relative to standpoint, not the top left corner of the
                // cell.
                -this.cell.w/2
            );
        }
        screen_z(point, view, perspectived) {
            return AAX.camerarotations(
                point, view,
                perspectived ? this.camera.xz : 0,
                perspectived ? this.camera.yz : 0
            )[2]
        }
        autoperspective(point, view) {
        // calculates perspective automatically based on camera xz/yz and the
        // viewer.
        // - NOTE:
        //   - it returns the difference between the previous position and the
        //     perspectived position.
        //   - this difference is always integers, for technical reasons.
        //     - it would technically make sense for them to be .5s too, but
        //       that would mean image oddness/dimensions can change from
        //       changes to the coordinates or drawsettings. ...my intuition
        //       says that's a bad idea.
        //       - i thiiink image getters adjust for oddness differences..? or
        //         does that only happen if it gets the image from the body? i'm
        //         not checking.
        //     - and besides breaking things, it's also weird and unpredictable
        //       for dimensions to fluctuate like that. i'd have to make a
        //       boolean/button for turning that on/off.
        //     - it's possible and all, but it's a lot of trouble for something
        //       i don't want. the more complicated a system is, the easier it
        //       is to accidentally break something.
            let _point = AAX.camerarotations(point, view, this.camera.xz, this.camera.yz);
            if(this.ratio !== "none") {
                let viewer = this.viewer;
                let central_z = viewer.central_z;
                _point[2] += central_z;
                // the central_z is the z where sizes will be about the same as they
                // are in 2d, so adding this will make it so things more or less
                // stay put if their z is 0.
                // - and add the standpoint too, since that's how perspectiveconvert
                //   expects it.
                _point = viewer.convert(..._point);
            };
            return Points.trunc( Points.subtract(_point, AAX.camerarotations(point, view)) ).slice(0, 2);
            //return [
            //    Math.trunc(_point[0] - point[0]),
            //    Math.trunc(_point[1] - point[1])
            //];
            // compare to how it was just after the view rotation, force
            // integers
        }
    },
    Color: class {
    // class for storing data
        constructor() {
            Object.assign(this, AAX.Color.template)
        }
        static template = {
            background: "#ffe7d7",
            // flat color
            grid: [
                "#dfcfaf",
                "#a7977f",
                "#5f4f2f",//"#472f00"
            ],
            // colors of every grid line
            side_tint: "#ff7f001f",
            // this color is drawn over the entire grid, for those views.
            silhouette_fill: "#ffffff",
            //silhouette: ["#2f2f5f", "#9fcfff", "#cf9fff"],
            //silhouette: ["#2f2f5f", "#2f2f5f", "#2f475f", "#472f5f"],
            silhouette: ["#2f2f5f", "#3f7f3f", "#7f3f3f"],
            // by default, this is "draw outlines in dark blue, but draw
            // interior arm outlines in dark azure"
            // - the code i use to draw silhouettes isn't nearly smart
            //   enough to draw real interior outlines. all it does is calculate
            //   each silhouette group separately, and draw any outlines that
            //   are different.
            // - after all, the goal is to make stuff that can be edited
            //   manually. to edit them, i need to know where the edges are.
            // - and the legs should be indistinguishable from the body, but
            //   for some poses you might want to do the same thing it does
            //   to the arms.
            parts: [
            // defining a part's color1 or color2 makes it use colors from
            // this array.
                "black",
                "#ef007f", // violet red
                "#bfef1f", // lime
                "#007fef", // azure
                "#7f00ef" // purple
            ],
            part_interior: "white",
            // insides of parts
            skeleton: "black",
            perspective: "#ff6f00",//"black",
            // color of lines it draws between perspectived and
            // unperspectived coordinates.
            nodes: "orange",
            interface: ["black", "white", "gray"],
            // colors used in the multiview interaction
            buttons: ["orange", "white", "#ffdfef"],
        }
    },
    initialize: function() {
        for (let property in AAX.part_properties) {
        // complete part_properties
            if (AAX.part_properties.hasOwnProperty(property)) {
            // making getters, converting AAX.part_properties
                AAX.part_properties[property] = {
                    type: AAX.part_properties[property],
                    children: [],
                };
                let ref = AAX.part_properties[property];
                let generation = property.split("_").length;
                for(i1 in AAX.part_properties) {
                    if(AAX.part_properties.hasOwnProperty(i1) && i1.startsWith(property + "_") && i1.split("_").length === (generation + 1)) {
                        ref.children[ ref.children.length ] = i1;
                    }
                }
                // form the children array (only direct children, not
                // descendants)
                // - i could make Part.get figure this out, but that seems
                //   like unnecessary work for it. it runs every time a
                //   getter is used.
            }
        }
        for (let property in AAX.part_properties) {
        // make getters for AAX.Part
            if (AAX.part_properties.hasOwnProperty(property) && AAX.part_properties[property].type !== "pose_exclusive") {
                Object.defineProperty(AAX.Part.prototype, property, {
                    get() {
                        return this.get(property);
                    },
                    set(value) {
                        this.set(property, value);
                    },
                });
            }
        }
    },
    abscoor: function(body, part) {
    // returns the absolute coordinates of the specified part.
        let coor = [0, 0, 0];
        let chain = [];
        //console.log(part);
        function sum(part) {
        // adds a part's coordinates, then runs this on their parent, until
        // the standpoint is reached.
            //console.log([body, part]);
            chain[chain.length] = part;
            coor[0] += body[part].x;
            coor[1] += body[part].y;
            coor[2] += body[part].z;
            if(chain.includes(body[part].parent)) {
                console.log("there's a circular relationship of part parents. (ie part A's coordinates are relative to part B's coordinates, which are relative to part C's coordinates, which are relative to part A's coordinates. it makes no sense and gets added infinitely.)");
            }
            else if(body[part].parent !== "standpoint") {
            // stop if it's the standpoint
                sum(body[part].parent);
            };
        }
        sum(part);
        return coor;
    },
    all_rel: function(body) {
    // returns an object of all the parts' relative coordinates. (pretty much
    // only useful in AAX.bodychange.)
        let coor = {};
        for(let i1 in body) {
            if(body.hasOwnProperty(i1)) {
                coor[i1] = AAX.relcoor(body[i1]);
            }
        }
        return coor;
    },
    all_abs: function(body) {
    // returns an object of all the parts' absolute coordinates. (using abscoor
    // on each part individually is more wasteful.)
        let i1 = 0;
        let i2 = 0;
        let loop = new Loop("AAX.all_abs");
        let order = AAX.getdesc(body);
        let coor = {};
        for (i1 in body) {
            loop.tick(1);
            if (body.hasOwnProperty(i1)) {
                coor[i1] = body[i1].relcoor;
            };
        }
        loop.end();
        for(i1 = 0; i1 < order.length; i1++) {
            loop.tick(1);
            let part = order[i1];
            for (i2 in coor) {
                loop.tick(2);
                if (coor.hasOwnProperty(i2) && body[i2].parent === part) {
                    coor[i2][0] += coor[part][0];
                    coor[i2][1] += coor[part][1];
                    coor[i2][2] += coor[part][2];
                };
            }
            loop.end();
        }
        loop.end();
        return coor;
    },
    relcoor: (part) => [part.x, part.y, part.z],
    oddness: function(body, name) {
        let coor = AAX.abscoor(body, name);
        return [
            !!(coor[0]%1),
            !!(coor[1]%1),
            !!(coor[2]%1)
        ];
    },
    // an array for which axes' absolute coordinates are non-integers.
    rel_oddness: (part) => [!!(part.x%1), !!(part.y%1), !!(part.z%1)],
    // something similar for relative coordinates.
    image_oddness: function(body, part, view) {
    // returns the oddness relevant to the specified image.
    // - [0] is the image x, [1] is image y.
    // - for front/right it's AAX.oddness[0 or 2] and AAX.oddness[1].
    // - and it's similar for perspective images, except it also adds the
    //   perspective coordinates when calculating oddness
        if(view === "front" || view === "right") {
            let oddness = AAX.oddness(body, part);
            return [
                oddness[view === "right" ? 2 : 0],
                oddness[1]
            ];
        };
        const coor = AAX.abscoor(body, part);
        let _coor = (
            body instanceof AAX.Body ? body[part].perspective.coor[view] :
            // body
            body[part] instanceof AAX.Part ? body[part]["perspective_coor_" + view] :
            // pose
            null
            // use partobj_image_oddness instead. (but this probably ran into an
            // error already anyway. partobjs don't have parents.)
        );
        if(_coor === "auto") {
        // only AAX.Parts have fancy getters to run this.
        // - but also, autoperspective always returns integers. i could change
        //   that, but it'd be complicated and not super worth it. (read the
        //   AAX.autoperspective comments.)
            _coor = [0, 0];
        };
        return [
            !!((coor[view%2 ? 2 : 0] + _coor[0])%1),
            !!((coor[1] + _coor[1])%1)
        ];
    },
    partobj_image_oddness: function(base, name, partobj, view) {
    // a version of image_oddness that works on partobjs.
    // - base: the Body the pose was based on.
        let anc = AAX.getanc(base, name);
        let coor = [0, 0, 0];
        for(let i1 = 0; i1 <= anc.length; i1++) {
            coor = Points.add(coor, Points.convert(i1 === anc.length ? partobj : base[name]));
        }
        if(view === "front" || view === "right") {
            return [
                !!((coor[view === "right" ? 2 : 0])%1),
                !!((coor[1])%1)
            ];
        };
        let _coor = (
            partobj.hasOwnProperty("perspective")
            &&
            partobj.perspective.hasOwnProperty("coor")
            &&
            partobj.perspective.coor.hasOwnProperty(view)
            ?
            partobj
            :
            base[name]
        ).perspective.coor[view];
        console.log(_coor);
        if(_coor === "auto") {
            _coor = [0, 0];
        }
        console.log(_coor);
        return [
            !!((coor[view%2 ? 2 : 0] + _coor[0])%1),
            !!((coor[1] + _coor[1])%1)
        ];
    },
    onedim: (size, odd) => Math.abs(size) + (!!odd === !!(size%2)),
    l_size: function(length, oddness, right) {
    // returns a size number something like aa.box can use, using the image
    // length.
    // - images are always square-shaped, except there might be a dimension
    //   difference of 1 depending on the oddness.
    // - onedim always returns size or size + 1, so it's always possible to
    //   figure out size from the image length just through a few cycles of
    //   trial and error.
    //   - +0 and +0: size = sqrt(length)
    //   - +0 and +1: size = floor(sqrt(length))
    //   - +1 and +1: size = sqrt(length) - 1
    //   - we can check those hypotheticals with onedim.
    // - right is only relevant if oddness is [x, y, z] instead of whatever
    //   axes the image x/y axes use.
        let _oddness = oddness.length === 2 ? oddness : [oddness[right ? 2 : 0], oddness[1]];
        // convert oddness to 2d
        let _size = Math.sqrt(length);
        let size = Math.floor(_size);
        // in the +0 and +0 hypothetical, _size would be an integer already,
        // so this checks +0/+0 and +0/+1 at the same time.
        let w = AAX.onedim(size, _oddness[0]);
        let h = AAX.onedim(size, _oddness[1]);
        if(w*h === length) {
            return size;
        }
        else if(!Number.isInteger(_size)) {
        // in the +1/+1, _size would be an integer. i don't know what
        // happened if this triggered. the image length probably can't be
        // configured into a squarish image at all.
            return null;
        };
        size--;
        // if +1/+1: size = sqrt(length) - 1
        w = AAX.onedim(size, _oddness[0]);
        h = AAX.onedim(size, _oddness[1]);
        return (
            w*h === length
            ?
            size
            :
            null
        );
    },
    l_dim: function(length, oddness, right) {
    // takes an image length and oddness booleans, and figures out the w/h.
    // (or returns null if the number is invalid.) check the l_size comments
    // for how it works.
        let _oddness = oddness.length === 2 ? oddness : [oddness[2*(!!right)], oddness[1]];
        // convert oddness to 2d
        let size = AAX.l_size(length, _oddness);
        return (
            size === null
            ?
            null
            :
            [
                AAX.onedim(size, _oddness[0]),
                AAX.onedim(size, _oddness[1])
            ]
        );
    },
    dim: function(body, part, view, length, size) {
    // runs l_dim with these arguments instead.
    // - length: if included, it will use that instead of calculating it
    //   from the image.
    //   - NOTE if you run it without length, it'll return null if the image
    //     in that spot is a redirect. this is to avoid excessive
    //     .rasterize runnings. use l_dim instead if you don't have the
    //     image handy.
    // - size: if true, it'll run l_size instead.
        length = typeof length === "number" ? length : null;
        const perspectived = view !== "front" && view !== "right";
        const isbody = !(body[part] instanceof AAX.Part);
        if(length === null) {
            let temp = perspectived ? "perspective" : "image";
            if(
                isbody
                ?
                (body[part][temp][view] === null)
                :
                !body[part].isreal(temp + "_" + view)
            ) {
                // if the image isn't real, return null. (it'd be a waste to run
                // rasterize or something for this, which is what the image getters
                // would do.)
                return null;
            };
            length = (
                isbody
                ?
                body[part][temp][view]
                :
                body[part][temp + "_" + view]
            ).length;
        }
        const oddness = AAX.image_oddness(body, part, view);
        return (
            size
            ?
            AAX.l_size(length, oddness)
            :
            AAX.l_dim(length, oddness)
        );
    },
    ui: {
    // used in aa.ui draw/action and similar functions.
    // - mostly, this is just a place to store code i end up reusing. i can't
    //   put the code for the inbetween buttons here, because that's too
    //   integrated into aa specifically. but i can avoid writing code for the
    //   drawsettings buttons twice by putting it in here.
        block: 8,
        // unit of measurement for buttons.
        depress: 1/8,
        // how many seconds to depress buttons for when they're clicked
        font: "6px 'thick 4x4'",
        margin: [2, 1],
        // adjustments to where text goes relative to the center-left of the
        // button
        lineheight: 8,
        charwidth: 4,
        drawinfo: {
        // generally, these return an object rather than drawing directly.
        // ctx tool suffix

        },
        action: {

        },
    },
    camerarotations: function(point, view, xz, yz, etc) {
    // returns a version of the point that has been rotated to match the given
    // view, and the given camera xz/yz.
    // - etc: caveat strings. (can be a string array or one string.)
    //   - "same floats": keeps the same floats it had before.
        xz ??= 0;
        yz ??= 0;
        etc ??= [];
        etc = Array.isArray(etc) ? etc : [etc];
        let _point = revolve(
            yz,
            revolve(
                xz + (view ?? 0)*Math.PI/2,
                point,
                false,
                "xz"
            ),
            false,
            "yz"
        );
        return (
            etc.includes("same floats")
            ?
            Points.add(point, Points.trunc( Points.subtract(_point, point) ))
            //[
            //    point[0] + Math.trunc(_point[0] - point[0]),
            //    point[1] + Math.trunc(_point[1] - point[1]),
            //    point[2] + Math.trunc(_point[2] - point[2])
            //]
            :
            _point
        );
    },
    coortocanvas: function(cell, standpoint, point, view, nonulls, viewoffset) {
    // input a 3d point and desired view, and it'll give the coordinates
    // relative to the top left of the canvas, or null if it's off the
    // canvas.
    // - cell, standpoint: properties of a drawsettings
    // - nonulls: disables the null return. in some cases, like finding the
    //   grid offset, it isn't a problem if it's off the canvas.
    // - viewoffset: boolean for adding the offset specific to the view.
    //   (ex: view 2's left edge is 2*cell.w, so that should be added to any
    //   x positions.)
        let coor = [
            standpoint.x,
            standpoint.y
        ];
        coor[1] += point[1];
        coor[0] += point[ view%2 === 0 ? 0 : 2 ];
        if([1, 2].includes(view)) {
        // flip relative to the center
            coor[0] -= cell.w/2;
            coor[0] *= -1;
            coor[0] += cell.w/2;
        };
        return (
            !nonulls
            &&
            (
                coor[0] < 0
                ||
                coor[0] >= cell.w
                ||
                coor[1] < 0
                ||
                coor[1] >= cell.h
            )
            ?
            null
            :
            [!!viewoffset*view*cell.w + coor[0], coor[1]]
        );
    },
    draw_background: function(ctx, drawsettings, color, perspectived, numofcells) {
        let i1 = 0;
        let i2 = 0;
        let loop = new Loop("AAX.draw_background");
        let view = 0;
        if(
            !(ctx instanceof CanvasRenderingContext2D)
            ||
            !(drawsettings instanceof AAX.DrawSettings)
            ||
            !(color instanceof AAX.Color)
            ||
            !Number.isInteger(numofcells) || numofcells <= 0 || numofcells > 4
        ) {
            console.log("invalid arguments.");
            return;
        }
        let ref = drawsettings;
        numofcells ??= 4;
        let cell = ref.cell;
        let imagedata = [];
        for(view = 0; view < numofcells; view++) {
            imagedata[view] = ctx.getImageData(view*cell.w, 0, cell.w, cell.h);
        }
        ctx.canvas.width = cell.w;
        ctx.canvas.height = cell.h;
        for(view = 0; view < numofcells; view++) {
            loop.tick("view");
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if(ref.background !== "blank") {
                ctx.fillStyle = color.background;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            };
            if(ref.background === "grid") {
                let temp = null;
                // this will store which grid index, if any, was a zero, so it
                // knows which grid color to use.
                let inc = 1;
                // "increment"
                let getcolor = (num) => (
                    num >= color.grid.length
                    ?
                    color.grid[(color.grid.length - 1)]
                    :
                    color.grid[num]
                );
                for(i1 = 0; i1 < ref.grid.length; i1++) {
                // run for each grid type
                    loop.tick(1);
                    let num = ref.grid[i1];
                    if(num === 0) {
                        temp = i1;
                    }
                    else {
                        inc *= num;
                        ctx.fillStyle = getcolor(i1);
                        let origin = AAX.coortocanvas(cell, ref.standpoint, [0, 0, 0], view, true);
                        for(i2 = posmod(origin[1], inc); i2 < cell.h; i2 += inc) {
                            // horizontal
                            loop.tick(2);
                            ctx.fillRect(0, i2, cell.w, 1);
                        };
                        loop.end();
                        for(i2 = posmod(origin[0], inc); i2 < cell.w; i2 += inc) {
                            // vertical
                            loop.tick(2);
                            ctx.fillRect(i2, 0, 1, cell.h);
                        };
                        loop.end();
                    };
                }
                loop.end();
                if(temp !== null) {
                    ctx.fillStyle = getcolor(temp);
                    let coor = AAX.coortocanvas(cell, ref.standpoint, [0, 0, 0], view, true);
                    if(perspectived) {
                    // if it's in perspective mode, apply perspective to the
                    // standpoint.
                        let temp = [0, 0, ref.viewer.central_z];
                        temp = Points.subtract(ref.viewer.convert(...temp), temp);
                        // converting [0, 0, 0] should get you how much
                        // standpoint moved from perspective.
                        coor = Points.add(coor, [temp[0], temp[1]]);
                    };
                    if(coor[1] >= 0 && coor[1] < cell.h) {
                        ctx.fillRect(0, coor[1], cell.w, 1);
                        // horizontal
                    }
                    if(coor[0] >= 0 && coor[0] < cell.w) {
                        ctx.fillRect(coor[0], 0, 1, cell.h);
                        // vertical
                    }
                }
            }
            if(ref.background !== "blank" && view%2 === 1) {
                // add side tint
                ctx.fillStyle = color.side_tint;
                ctx.fillRect(0, 0, cell.w, cell.h);
            };
            imagedata[view] = ctx.getImageData(0, 0, cell.w, cell.h);
        }
        loop.end();
        ctx.canvas.width = numofcells*cell.w;
        ctx.clearRect(0, 0, numofcells*cell.w, cell.h);
        for(view = 0; view < numofcells; view++) {
            loop.tick("view");
            ctx.putImageData(imagedata[view], view*cell.w, 0);
        }
        loop.end();
    },
    posint: (num) => Math.abs(Math.round(typeof num === "string" ? Number(num) : num)),
    strings: {
    // functions for interpreting strings as values. usually, stuff used in the
    // bodytext interpreter
        coor: function(string, roundfactor) {
            // converts a string of coordinates into an array of numbers.
            roundfactor ??= 2;
            // means it rounds to the nearest .5.
            let coor = (
                Array.isArray(string)
                ?
                structuredClone(string)
                :
                string.split(",")
            );
            if(coor.length !== 3) {
                return null;
            };
            coor = [
                Math.round(Number(coor[0])*roundfactor)/roundfactor,
                Math.round(Number(coor[1])*roundfactor)/roundfactor,
                Math.round(Number(coor[2])*roundfactor)/roundfactor
            ];
            return (
                (isNaN(coor[0]) || isNaN(coor[1]) || isNaN(coor[2]))
                ?
                null
                :
                coor
            );
        },
        dimension: function(string) {
            // interprets a string of one dimension or three, and returns one
            // number or three in turn. (or null if the string is screwed up.)
            let loop = new Loop("AAX.strings.dimension");
            if(Array.isArray(string)) {
                string = string.join();
            };
            string = string.split(",");
            for(let i1 = 0; i1 < string.length; i1++) {
                loop.tick(1);
                string[i1] = AAX.posint(string[i1]);
                if(isNaN(string[i1])) {
                    return null;
                };
            }
            loop.end();
            return string;
        },
        float: function(string) {
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
        },
        tilt: function(string) {
            // array should be an array of strings that start with yz, xz,
            // or xy, a colon, then a 0 to 1 number. it'll create a
            // quaternion from that.
            if(!Array.isArray(string)) {
                string = string.split(",");
            };
            let loop = new Loop("AAX.strings.tilt");
            if(
                string.length >= 4
                &&
                string[0].startsWith("w:")
                &&
                string[1].startsWith("x:")
                &&
                string[2].startsWith("y:")
                &&
                string[3].startsWith("z:")
            ) {
                // written as a quaternion
                for(let i1 = 0; i1 < 4; i1++) {
                    loop.tick(1);
                    string[i1] = AAX.strings.float(string[i1].slice(2));
                    if(string[i1] === null) {
                        return null;
                    }
                }
                loop.end();
                return {
                    w: string[0],
                    x: string[1],
                    y: string[2],
                    z: string[3],
                };
            };
            let tilt = null;
            for(let i1 = 0; i1 < string.length; i1++) {
                loop.tick(1);
                let rotation = string[i1].split(":");
                if(rotation.length >= 2) {
                    let axis = rotation[0].trim();
                    let angle = AAX.strings.float(rotation[1]);
                    // can use fractions
                    if(["yz", "xz", "xy"].includes(axis) && angle%1) {
                        angle = posmod(angle, 1)*2*Math.PI;
                        tilt ??= Quat.new();
                        tilt = Quat.rotate(tilt, axis, angle);
                    };
                }
            }
            loop.end();
            return tilt;
        },
        shape: function(string, body, partname) {
            // body and partname aren't strictly necessary, they just prevent
            // bullshit external part names
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            let loop = new Loop("AAX.strings.shape");
            partname ??= null;
            let shape = {
                points: [],
                external: {
                    groups: {},
                    points: {},
                },
            };
            let total = 0;
            // number of points in finished groups.
            string = uncomment(string.trim()).split("|");
            let lastreal = null;
            // last point that wasn't a duplicate or inversion. (array of group
            // index and point index.)
            for(i1 = 0; i1 < string.length; i1++) {
                // |s split them into groups
                loop.tick(1);
                shape.points[i1] = [];
                string[i1] = string[i1].trim().split(String.fromCharCode(10));
                for(i2 = 0; i2 < string[i1].length; i2++) {
                    // line breaks split it up into points
                    loop.tick(2);
                    string[i1][i2] = string[i1][i2].trim();
                    if(i2 === 0 && (!body || body.hasOwnProperty(string[i1][i2])) && string[i1][i2] !== partname) {
                        // if the group starts with a line of
                        // another body part, (whether right
                        // after the | or on its own line)
                        // create a shape.external property that
                        // says this group of points belongs to
                        // that part.
                        let ref = shape.external.groups;
                        ref[ string[i1][i2] ] ??= [];
                        ref[ string[i1][i2] ][ ref[ string[i1][i2] ].length ] = i1;
                    }
                    else if(string[i1][i2]) {
                        // skip blank lines. those could be
                        // interpreted as "copy point 0", which
                        // bothers me for some reason
                        let point = string[i1][i2];
                        let temp = [point.indexOf(":"), point.indexOf(",")];
                        temp = (
                            temp[1] !== -1
                            &&
                            temp[1] < temp[0]
                            ?
                            -1
                            :
                            temp[0]
                        );
                        // make it if the first comma is before the colon.
                        // (since colons are used in spheroid orientation
                        // syntax.)
                        let _external = temp === -1 ? partname : point.slice(0, temp).trim();
                        if(temp !== -1) {
                            point = point.slice(temp + 1).trim();
                        };
                        // if it has a colon, interpret it
                        // as a point that follows another
                        // part's orient/stretch/widen
                        temp = shape.points[i1].length;
                        // store the previous length so it
                        // can tell if a point was added
                        // this loop
                        if(point.includes(",")) {
                            point = point.split(",");
                            let coor = AAX.strings.coor(point.slice(0, 3), 1);
                            let dim = AAX.strings.dimension(point.slice(3, 6));
                            // makes sure they're valid,
                            // returns null if they're not
                            let tilt = AAX.strings.tilt(point.slice(6));
                            // quaternion
                            if(coor) {
                                point = structuredClone(coor);
                                if(dim && Math.hypot(...dim)) {
                                    // ignore null, but also 0
                                    // radius
                                    point = point.concat(dim);
                                    if(tilt) {
                                        point[point.length] = structuredClone(tilt);
                                    };
                                }
                                lastreal = [i1, temp];
                                shape.points[i1][ temp ] = structuredClone(point);
                            }
                        }
                        else {
                            // duplicate or inversion of a previous point.
                            let invert = [];
                            for(i3 = 0; i3 < 3; i3++) {
                                loop.tick(3);
                                if(point.startsWith("xyz"[i3])) {
                                    invert[invert.length] = i3;
                                    point = point.slice(1);
                                }
                            }
                            loop.end();
                            // if it starts with axis letters, invert those
                            // axes.
                            let index = null;
                            if(point.trim()) {
                                // if there's content after the axis letters, take
                                // it as a linear index.
                                index = Number(point);
                                if(Number.isInteger(index)) {
                                    if(index < 0) {
                                        // interpret -1 as the previous point, -2 as the
                                        // point before that, etc.
                                        index += total + temp;
                                    };
                                    if(point >= 0 && index < total + temp) {
                                        index = AAX.points_linear_index(shape.points, num);
                                        console.log({
                                            points: structuredClone(shape.points),
                                            num,
                                            index,
                                        });
                                    }
                                    else {
                                        index = null;
                                    };
                                }
                                else {
                                    index = null;
                                };
                            }
                            else {
                                // otherwise, just use the last non-duplicate point.
                                index = lastreal;
                            };
                            if(index !== null) {
                                // this also catches uses of lastreal before the
                                // first real point.
                                shape.points[i1][ temp ] = structuredClone(shape.points[ index[0] ][ index[1] ]);
                                for(i3 = 0; i3 < invert.length; i3++) {
                                    loop.tick(3);
                                    shape.points[i1][ temp ][ invert[i3] ] *= -1;
                                }
                                loop.end();
                                // inversion
                            };
                        };
                        if(shape.points[i1].length > temp && (!body || body.hasOwnProperty(_external)) && _external !== partname) {
                            // if a point was added, this point
                            // was specified as following
                            // another part's orient/etc, and
                            // the part exists and isn't the
                            // current part, add it to an array
                            // of linear indexes.
                            let ref = shape.external.points;
                            ref[_external] ??= [];
                            ref[_external][ ref[_external].length ] = total + shape.points[i1].length - 1;
                        };
                    };
                };
                loop.end();
                total += shape.points[i1].length;
            }
            loop.end();
            return shape;
        },
    },
    getchildren: function(body, part) {
        let i1 = 0;
        let loop = new Loop("AAX.getchildren");
        part ??= "standpoint";
        let array = [];
        for(i1 in body) {
            loop.tick(1);
            if(body.hasOwnProperty(i1) && body[i1].parent === part) {
                array[array.length] = i1;
            }
        }
        loop.end();
        return array;
    },
    getdesc: function(body, part, generations) {
    // it's like PosedBody.getdescendants, from the posing interface.
    // except you don't have to use .flat(Infinity) because the unflatted
    // form is never useful.
    // - if part is standpoint or falsy, it'll return all parts
    // - this creates an array of all of a part's descendants, in an order
    //   that guarantees parents are iterated on before their children.
    // - generations: if it's 1, it'll only return direct children. 2,
    //   children and grandchildren. etc. if it's nullish, it'll just return
    //   everything.
        let i1 = 0;
        let loop = new Loop("AAX.getdesc");
        generations = typeof generations === "number" ? Math.max(0, Math.floor(generations)) : null;
        if(generations === 0) {
            return [];
        };
        let array = [];
        if(!part) {
            part = "standpoint";
        };
        for (i1 in body) {
            loop.tick(1);
            if (body.hasOwnProperty(i1) && body[i1].parent === part) {
                array[array.length] = i1;
                array = array.concat(AAX.getdesc(body, i1, generations === null ? null : generations - 1));
            }
        }
        loop.end();
        return array;
    },
    getanc: function(body, part) {
    // array of ancestors, from furthest to closest.
        let loop = new Loop("AAX.getanc");
        let array = [];
        part = body[part].parent;
        for(; part !== "standpoint" && !array.includes(part);) {
            loop.tick(1);
            array.splice(0, 0, part);
            part = body[part].parent;
        };
        loop.end();
        return array;
    },
    getstem: (body, part) => (
        body[part].parent === "standpoint"
        ?
        part
        :
        AAX.getanc(body, part)[0]
    ),
    // returns the standpoint child.
    // - come to think of it, getanc isn't used for anything but this. oh
    //   well.
    valid: {
    // stores arrays for which values are accepted, whether to check for
    // validity or iterate through them. mostly for drawsettings.
        posetools: ["move", "deform", "rotate", "tilt", "perspective"],
        // pose tool names. used to create the buttons, and cycle through
        // them.
        background: ["gridless", "grid", "blank"],
        silhouette: ["off", "on", "overlap"],
        parts: ["off", "on", "overlap"],
        clearcache: [
        // event types that AAX.clearcache accepts.
            "orientedshape",
            "rasterize perspective"
        ],
        connection: ["generation", "capsule"],
        view: ["front", "right", 0, 1, 2, 3],
        refresh: ["draw", "ui", "states"],
    },
    cache_init: {
        oriented: null,
        rasterize: {
            "front": null,
            "right": null,
            0: null,
            1: null,
            2: null,
            3: null,
        },
    },
    // empty cache object, used for initializing part caches
    clearcache: function(body, part, type) {
    // - type: what kind of event warrants a cache clear.
    //   - orientedshape: a change in what AAX.Part.orientedshape would
    //     create. clears .oriented and .rasterize.
    //   - rasterize perspective: a change in something that affects the
    //     perspective positioning of points. clears rasterize 0-3.
        if(Array.isArray(type)) {
            let loop = new Loop("AAX.clearcache");
            for(let i1 = 0; i1 < type.length; i1++) {
                loop.tick(1);
                AAX.clearcache(body, part, type[i1]);
            }
            loop.end();
            return;
        };
        if(!AAX.valid.clearcache.includes(type)) {
            console.log("this shouldn't happen");
        };
        let ref = body[part].cache;
        if(type === "orientedshape") {
            ref.oriented = null;
            ref.rasterize = {
                "front": null,
                "right": null,
                0: null,
                1: null,
                2: null,
                3: null,
            };
        }
        else if(type === "rasterize perspective") {
            for(let i1 = 0; i1 < 4; i1++) {
                ref.rasterize[i1] = null;
            }
        }
    },
    points_linear_index: function(points, index, inverse) {
    // shape_points are divided into groups, but sometimes there's number indexes
    // that expect it to be an unbroken array of points.
    // - returns null if it's out of range
    // - inverse: converts an array of group and point index into a linear
    //   index.
        let i1 = 0;
        let i2 = 0;
        let num = 0;
        // total of the points groups its been through.
        if(inverse) {
            for(i1 = 0; i1 < index[0]; i1++) {
                loop.tick(1);
                num += points[i1].length;
            }
            loop.end(0);
            // total up previous groups
            num += index[1];
            return num;
        }
        if(!Number.isInteger(index) || index < 0) {
            return null;
        };
        for(i1 = 0; i1 < points.length; i1++) {
        // run through each group
            loop.tick(1);
            let _num = index - num;
            // supposing it's in this group, this would be the index it has.
            if(_num < 0) {
                console.log("this shouldn't happen");
            }
            else if(_num < points[i1].length) {
            // index is in this group
                return [i1, _num];
            }
            else {
                num += points.length;
            };
        }
        loop.end();
        return null;
    },
    sym_namer: (name) => (
        name.startsWith("l_")
        ?
        name.replace("l_", "r_")
        :
        name.startsWith("r_")
        ?
        name.replace("r_", "l_")
        :
        name
    ),
    mirror: function(body, name, axis) {
    // mirrors an entire part, editing it directly.
    // - body: body or pose
    // - name: string the part is stored under
    // - axis: a letter
        let i1 = 0;
        let i2 = 0;
        let loop = new Loop("AAX.mirror");
        const isbody = !(body[name] instanceof AAX.Part);
        let part = body[name];
        part[axis] *= -1;
        // x, y, z
        let ref = part[(isbody ? "" : "_") + "shape"].points;
        let num = "xyz".indexOf(axis);
        for(i1 = 0; i1 < ref.length; i1++) {
            loop.tick(1);
            for(i2 = 0; i2 < ref[i1].length; i2++) {
            // mirror all points
                loop.tick(2);
                ref[i1][i2][num] *= -1;
            }
        }
        loop.end();
        for(i1 = 0; i1 < 2; i1++) {
        // mirror shape.external
            loop.tick(1);
            ref = part[(isbody ? "" : "_") + "shape"].external[i1 ? "points" : "groups"];
            let obj = {};
            for(i2 in ref) {
                loop.tick(2);
                if(ref.hasOwnProperty(i2)) {
                    let sym_name = AAX.sym_namer(i2);
                    if(body.hasOwnProperty(sym_name)) {
                    // if it didn't do this, you could run into trouble if
                    // there's a l_elbow but not a r_elbow, like for a
                    // one-armed character.
                        sym_name = i2;
                    }
                    obj[sym_name] = structuredClone(ref[i2]);
                }
            }
            loop.end();
            part[(isbody ? "" : "_") + "shape"].external[i1 ? "points" : "groups"] = structuredClone(obj);
            // it seems roundabout to make a whole new object, but the logic
            // gets tricky otherwise.
            // - have to make sure that if there's externals for both
            //   l_elbow and r_elbow already, they switch, but only once
            // - have to make sure anything that was already swapped isn't
            //   iterated over again.
            // =
            // - it's not impossible but it sucks.
        }
        loop.end();
        // shape
        if(part.image.front) {
            const w = AAX.dim(body, name, "front")[0];
            //const w = AAX.dim(body, name, "front", part.image.front.length)[0];
            if(axis === "x") {
                part.image.front = Raster.xmirror(part.image.front, w);
            }
            else if(axis === "y") {
                part.image.front = Raster.ymirror(part.image.front, w);
            }
        };
        if(part.image.right) {
            const w = AAX.dim(body, name, "right")[0];
            //const w = AAX.dim(body, name, "right", part.image.right.length)[0];
            if(axis === "y") {
                part.image.right = Raster.ymirror(part.image.right, w);
            }
            else if(axis === "z") {
                part.image.right = Raster.xmirror(part.image.right, w);
            };
        }
        ref = part[(isbody ? "" : "_") + "perspective"];
        if(axis === "x") {
        // switch left and right perspective images
            let temp = structuredClone(ref[1]);
            ref[1] = structuredClone(ref[3]);
            ref[3] = structuredClone(temp);
        };
        if(axis === "y") {
        // flip all perspectived views vertically.
            for(i1 = 0; i1 < 4; i1++) {
                loop.tick(1);
                if(ref[i1] !== null) {
                    ref[i1] = Raster.ymirror(ref[i1], AAX.dim(body, name, i1)[0]);
                    //ref[i1] = Raster.ymirror(ref[i1], AAX.dim(body, name, i1, ref[i1].length)[0]);
                }
            }
            loop.end();
        };
        if(axis === "z") {
        // switch front and back
            let temp = structuredClone(ref[0]);
            ref[0] = structuredClone(ref[2]);
            ref[2] = structuredClone(temp);
        };
        // .perspective
    },
    hypot: function(body, pose, partname, deform) {
    // used in places like aa pose tools.
    // - deform
    //   - if false, it'll always give the hypotenuse it has in the Body.
    //   - if true, it'll give the hypotenuse it has right now, unless it's
    //     within .5 of what it is in the Body.
    // - most of the time the user will want it to snap to what it is in the
    //   body, and using that as a base prevents rounding decay as well. but if
    //   they lengthened the limb for whatever reason, they wouldn't want
    //   rotations to reset it to the default length for seemingly no reason, so
    //   use the deform argument for stuff like that.
        const old = Math.hypot(...AAX.relcoor(body[partname]));
        const current = Math.hypot(...AAX.relcoor(pose[partname]));
        return (
            (
                !deform
                ||
                (
                    (current - old) > -.5
                    &&
                    (current - old) <= .5
                )
            )
            ?
            old
            :
            current
        );
    },
    fixfloats: function(point, float, hypot, list, sortby) {
    // input a point, an array of what each coordinate's
    // posmod(coordinate, 1) should be, and a hypotenuse it should be
    // within. it'll return a point with a similar angle and the right
    // floats, that's within hypot.
    // - specifically, it takes the angle numbers times hypot, and for each
    //   axis, the two numbers within 1 that have the right float are valid.
    // - it creates points from every possible combination of those, and
    //   whichever point has the highest Math.hypot while still being within
    //   hypot + .5 is returned.
    // - and also at the beginning, it converts the point to an angle, then
    //   to angle numbers, then multiplies that by hypot. otherwise all the
    //   points could be too close or too far.
    // - sortby:
    //   - "hypot": highest hypotenuse first
    //   - anything else: closest to unfixed point first (or the version
    //     modified to be close to the hypotenuse, rather.)
    // - list: if true, instead of returning a single point, it'll return a
    //   list of all points within the hypotenuse, sorted by Math.hypot.
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let loop = new Loop("AAX.fixfloats");
        if(typeof hypot !== "number") {
            hypot = Math.hypot(...point);
        }
        else {
            point = Angle.get(...point);
            if(!point) {
                point = [hypot, 0, 0];
            }
            else {
                point = Angle.numbers(point);
                point[0] *= hypot;
                point[1] *= hypot;
                point[2] *= hypot;
            };
            // this will catch anything outside the hypotenuse, and ensure it's
            // close to the hypotenuse.
        }
        const unfixed = structuredClone(point);
        let positions = [];
        for(i1 = 0; i1 < 3; i1++) {
        // find the closest numbers that have the correct float.
            loop.tick(1);
            let _float = posmod(point[i1], 1);
            positions[i1] = [
                Math.floor(point[i1]) + float[i1],
                Math.floor(point[i1]) + float[i1]
            ];
            if(float[i1] < _float) {
                positions[i1][1]++;
            }
            else if(float[i1] > _float) {
                positions[i1][0]--;
            }
            else if(float[i1] === _float) {
            // float already matches
                positions[i1] = [ point[i1] ];
            }
            else {
                console.log("this shouldn't happen");
            };
        }
        loop.end();
        point = [];
        // don't need the parameter anymore. this is an array of valid
        // points.
        let point_hypot = null;
        for(i1 = 0; i1 < positions[0].length; i1++) {
            loop.tick(1);
            for(i2 = 0; i2 < positions[1].length; i2++) {
                loop.tick(2);
                for(i3 = 0; i3 < positions[2].length; i3++) {
                    loop.tick(3);
                    let _point = [positions[0][i1], positions[1][i2], positions[2][i3]];
                    let _hypot = Math.hypot(..._point);
                    if(_hypot < hypot + .5) {
                        point[point.length] = structuredClone(_point);
                    };
                }
                loop.end();
            }
            loop.end();
        }
        loop.end();
        if(point.length === 0) {
        // it starts at a point whose Math.hypot is equal to hypot, each
        // axis has a range of 1 and the potential positions are in opposite
        // directions, and there's a +.5 allowance even if it goes over
        // hypot. therefore, at least one point should always be in the
        // sphere.
            console.log("this shouldn't happen.");
            return;
        }
        if(sortby === "hypot") {
        // highest hypotenuse first
            point.sort((a, b) => Math.hypot(...b) - Math.hypot(...a));
        }
        else {
        // closest to unfixed
            point.sort((a, b) => (
                Math.hypot(unfixed[0] - a[0], unfixed[1] - a[1], unfixed[2] - a[2])
                -
                Math.hypot(unfixed[0] - b[0], unfixed[1] - b[1], unfixed[2] - b[2])
            ));
        };
        return (
            list
            ?
            point
            :
            point[0]
        );
    },
};
AAX.initialize();

class Walker {
// a Walker is a little guy that moves around randomly. if you get lots of them
// together and color pixels based on where they are, you can make fire and
// other effects.
// - x, y, z: coordinates
// - velocity: {x, y, z} object of how much it moves per second/frame/etc
// - etc: anything else you want to store
    constructor(x, y, z, etc) {
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.z = z ?? 0;
        this.etc = etc ?? {};
        this.velocity = {
            x: 0,
            y: 0,
            z: 0,
        };
    }
    static clone(walker) {
        let clone = new Walker();
        for(let i1 in walker) {
            if(clone.hasOwnProperty(i1)) {
                clone[i1] = structuredClone(walker[i1]);
            }
        }
        return clone;
    }
    static place = {
    // functions that return a new Walker placed randomly along a geometric
    // feature.
        spheroid: function(x, y, z, w, h, d, edge, etc) {
            x ??= 0;
            y ??= 0;
            z ??= 0;
            w ??= 1;
            h ??= 1;
            d ??= 1;
            etc ??= [];
            etc = Array.isArray(etc) ? etc : [etc];
            let anglenum = Angle.rand();
            if(etc.includes("2d")) {
                anglenum[1] = 0;
            };
            anglenum = Points.multiply(Angle.numbers(anglenum), [w, h, d]);
            anglenum = Points.multiply(anglenum, (edge ? 1 : Math.random())/2);
            return new Walker(x + anglenum[0], y + anglenum[1], z + anglenum[2]);
        },
        sphere: (x, y, z, r, edge) => Walker.place.spheroid(x, y, z, 2*(r ?? 1), 2*(r ?? 1), 2*(r ?? 1), edge),
        ellipse: (x, y, w, h, edge) => Walker.place.spheroid(x, y, 0, w, h, 0, edge, "2d"),
        circle: (x, y, r, edge) => Walker.place.ellipse(x, y, 2*(r ?? 1), 2*(r ?? 1), edge),
        box: (x, y, z, w, h, d) => new Walker(
            x + w*Math.random(),
            y + h*Math.random(),
            z + d*Math.random()
        ),
        rect: (x, y, w, h) => Walker.place.box(x, y, 0, w, h, 0),
    }
    static vector = {
    // functions that give three-number arrays for use in positioning or velocity.
        x: () => [
            Math.random() < .5 ? -1 : 1,
            0,
            0
        ],
        y: () => [
            0,
            Math.random() < .5 ? -1 : 1,
            0
        ],
        z: () => [
            0,
            0,
            Math.random() < .5 ? -1 : 1
        ],
        // randomly move in one of two cardinals
        xy: () => Points.add(Walker.vector.x(), Walker.vector.y()),
        xz: () => Points.add(Walker.vector.x(), Walker.vector.z()),
        yz: () => Points.add(Walker.vector.y(), Walker.vector.z()),
        // randomly move diagonally
        king: function(_3d) {
        // randomly move in a cardinal or diagonal. like a king in chess.
        // - unlike angular movement, diagonals move 1 in both axes.
        // - it always moves.
            let move = [0, 0, 0];
            let dir = Math.floor(Math.random()*(_3d ? 26 : 8));
            if(dir >= (_3d ? 13 : 4)) {
            // avoid the center position
                dir++;
            }
            for(let i1 = 0; i1 < (_3d ? 3 : 2); i1++) {
                let temp = 3**i1;
                move[i1] = magnitude*(Math.floor((dir%(3*temp))/temp) - 1);
            }
            return move;
        },
        knight: function() {
        // like a knight in chess.
            let temp = Math.random() < .5;
            let x = temp ? 1 : 2;
            let y = temp ? 2 : 1;
            if(Math.random() < .5) {
                x *= -1;
            }
            if(Math.random() < .5) {
                y *= -1;
            }
            return [x, y, 0];
        },
        angle: function(_2d, direct, direct_curve) {
        // - direct, direct_curve: direct is an angle you want it close to,
        //   direct_curve is a number for how much of an effect you want that
        //   adjustment to have.
        //   - it makes a random 0 to 1 number, exponents that by direct_curve, and
        //     places it between direct and the random angle based on what that 0 to
        //     1 number is after.
        //   - so, if direct_curve is really high, it'll be right near direct, if
        //     it's low, it'll only sorta gravitate toward it, and no matter what,
        //     every angle is at least possible if not likely.
            direct = typeof direct === "number" ? [direct, 0] : Array.isArray(direct) ? direct : null;
            direct_curve ??= 1;
            let angle = Angle.rand();
            if(_2d) {
                angle[1] = 0;
            }
            if(direct) {
                if(compareobject(direct, angle)) {
                }
                else if(Angle.compare(direct, angle) === Math.PI) {
                // Angle.between can't be used for parallel angles. try again.
                    return Walker.vector.angle(_2d, direct, direct_curve);
                }
                else {
                    angle = Angle.between(direct, angle, Math.random()**direct_curve);
                }
            }
            return Angle.numbers(angle);
        },
    }
    turn(type, args, magnitude) {
    // overwrites .velocity with the return value of one of the .vector functions.
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;
        this.direct(type, args, magnitude);
    }
    direct(type, args, magnitude) {
    // adds the return value of one of the .vector functions to .velocity.
        args ??= [];
        magnitude ??= 1;
        if(type in Walker.vector) {
            let temp = Walker.vector[type](...args);
            for(let i1 = 0; i1 < 3; i1++) {
                this.velocity["xyz"[i1]] += magnitude*temp[i1];
            }
        }
    }
    shift(type, args, magnitude) {
    // moves the Walker with the return value of one of the .vector functions.
        args ??= [];
        magnitude ??= 1;
        if(type in Walker.vector) {
            let temp = Walker.vector[type](...args);
            for(let i1 = 0; i1 < 3; i1++) {
                this["xyz"[i1]] += magnitude*temp[i1];
            }
        }
    }
    process(time) {
        time ??= 1;
        for(let i1 = 0; i1 < 3; i1++) {
            this["xyz"[i1]] += time*this.velocity["xyz"[i1]];
        }
    }
}
class WalkerSet extends Array {
// class for storing and utilizing lots of Walkers.
    append(type, args, count) {
    // add walkers by naming a Walker.place function, arguments for it, and how
    // many you want.
        args ??= [];
        count ??= 1;
        if(Walker.place.hasOwnProperty(type)) {
            for(let i1 = 0; i1 < count; i1++) {
                this[this.length] = Walker.place[type](...args);
            }
        }
    }
    applymethod(method, args) {
    // applies the specified method and arguments for every Walker.
        args ??= [];
        if(method in Walker.prototype) {
            for(let i1 = 0; i1 < this.length; i1++) {
                this[i1][method](...args);
            }
        }
    }
    turn(type, args, magnitude) {
        this.applymethod("turn", [type, args, magnitude]);
    }
    direct(type, args, magnitude) {
        this.applymethod("direct", [type, args, magnitude]);
    }
    shift(type, args, magnitude) {
        this.applymethod("shift", [type, args, magnitude]);
    }
    process(time) {
        this.applymethod("process", [time]);
    }
    clone(index, num) {
    // splices in a duplicate of the given Walker, right after it.
        num ??= 1;
        for(let i1 = 0; i1 < num; i1++) {
            this.splice(index + 1, 0, Walker.clone(this[index]));
        }
    }
    clone_all(num) {
    // multiplies all Walkers in the set.
        num ??= 1;
        for(let i1 = 0; i1 < this.length; i1 += 1 + num) {
            this.clone(i1, num);
        }
    }
    mediandist(point) {
        if(!this.length) {
            return NaN;
        };
        let dist = [];
        for(let i1 = 0; i1 < this.length; i1++) {
            dist[i1] = Math.hypot(...Points.convert(this[i1]));
        }
        dist.sort((a, b) => a - b);
        return (
            dist.length%2
            ?
            dist[Math.floor(dist.length/2)]
            :
            (dist[dist.length/2 - 1] + dist[dist.length/2])/2
        );
    }
    condense(factor, center, radius) {
        let i1 = 0;
        let i2 = 0;
        factor ??= 1;
        if(!center) {
        // use an average of all positions
            center = [0, 0, 0];
            for(i1 = 0; i1 < this.length; i1++) {
                center = Points.add(center, Points.convert(this[i1]));
            }
            center = Points.divide(center, this.length);
        }
        let dist = [];
        for(i1 = 0; i1 < this.length; i1++) {
            dist[i1] = Points.subtract(Points.convert(this[i1]), center);
        }
        if(typeof radius !== "number") {
            radius = 2*this.mediandist(center);
        }
        for(i1 = 0; i1 < this.length; i1++) {
            let effect = mound(Math.hypot(...dist[i1])/radius);
            // 0 if it's right at the center, 1 if it's [radius] away or
            // further. shaped like a single mound of a cos curve, with the
            // input and output both being 0 to 1.
            let coor = Points.multiply(dist[i1], (1 - effect)**factor);
            // multiply the distance. (the crap from earlier was so that the
            // effect wouldn't be stronger the further they are. that'd be kind
            // of stupid...)
            coor = Points.add(center, coor);
            // new position
            Points.apply(coor, this[i1]);
        }
    }
    draw(ctx, x, y, rect_x, rect_y, w, h, func) {
    // draws the walkers onto a canvas.
    // - ctx, x, y: where to draw it
    // - rect_x, rect_y, w, h: defines the rectangular area to care about (this
    //   is the dimensions of the drawing, and walkers only matter if they're
    //   within this zone)
    // - func: a (walker_list) function. walker_list is an array of the walkers
    //   that matter for that pixel, and it should return the color to use for
    //   that pixel.
        let space = {};
        // - [x coordinates]
        //   - [y coordinates]
        //     - [walkers]
        let temp = [rect_x, rect_x + w];
        let l = Math.min(...temp);
        let r = Math.max(...temp);
        temp = [rect_y, rect_y + h];
        let u = Math.min(...temp);
        let d = Math.max(...temp);
        for(let i1 = 0; i1 < this.length; i1++) {
            let x = Math.round(this[i1].x);
            let y = Math.round(this[i1].y);
            if(
                x >= l && x < r
                &&
                y >= u && y < d
            ) {
                space[x] ??= {};
                space[x][y] ??= [];
                space[x][y][ space[x][y].length ] = this[i1];
            };
        }
        //console.log(space);
        for(let i1 in space) {
            if(space.hasOwnProperty(i1)) {
                for(let i2 in space) {
                    if(space[i1].hasOwnProperty(i2)) {
                        let temp = func(space[i1][i2]);
                        if(typeof temp === "string") {
                            ctx.fillStyle = temp;
                            ctx.fillRect(
                                x + Number(i1) - rect_x,
                                y + Number(i2) - rect_y,
                                1, 1
                            );
                        }
                    }
                }
            }
        }
    }
}

function mound(input) {
    return (Math.cos(Math.PI*Math.min(Math.abs(input), 1)) + 1)/2;
}
