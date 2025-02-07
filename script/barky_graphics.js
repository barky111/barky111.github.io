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
            _points[i1] = Points.add(offset, [points[i1][0], points[i1][1], (points[i1][2] ?? 0)]);
            _points[i1] = (
                viewer
                ?
                viewer.convert(..._points[i1])
                :
                _points[i1]
            ).slice(0, 2);
        }
        if(_points.length <= 3) {
            return _points;
        };
        let center = Points.centroid(_points);
        let dist = null;
        let furthest = null;
        // a _points index
        let taken = [];
        // array of booleans for which points are already in the outline
        for (i1 = 0; i1 < _points.length; i1++) {
            taken[i1] = false;
            let _dist = Math.hypot(...Points.subtract(_points[i1], center));
            if(furthest === null || _dist > dist) {
                furthest = i1;
                dist = _dist;
            };
        };
        if(!dist && dist !== 0) {
            console.log("this shouldn't happen");
            return [];
        };
        let outline = [];
        outline[0] = furthest;
        // for now, it's an array of indexes
        taken[furthest] = true;
        let loopexit = false;
        for (i1 = 0; !loopexit; i1++) {
            let currindex = outline[outline.length - 1];
            let currpoint = _points[currindex];
            let idealangle = (
                outline.length >= 2
                ?
                get2dangle(...Points.subtract(currpoint, _points[ outline[outline.length - 2] ]), true)
                // the angle of the most recent line segment.
                :
                (get2dangle(...Points.subtract(currpoint, center), true) + Math.PI/2)%(2*Math.PI)
                // an angle perpendicular to the angle from the center to the
                // current point.
            );
            // it judges which point should be the next by getting the angle
            // from the current point to that one and subtracting the
            // idealangle. (and posmoding it) lower is better.
            let lowestangle = null;
            let nextpoint = null;
            for (i2 = 0; i2 < _points.length; i2++) {
                if(!taken[i2] || i2 === outline[0]) {
                    let temp = Points.subtract(_points[i2], currpoint);
                    let angle = get2dangle(...temp, true);
                    if(angle !== null) {
                        angle = posmod(angle - idealangle, 2*Math.PI);
                        if(
                            lowestangle === null || angle < lowestangle
                            ||
                            (
                                angle === lowestangle
                                &&
                                Math.hypot(...temp) > Math.hypot(...Points.subtract(_points[nextpoint], currpoint))
                                // if the angle matches perfectly, choose whichever
                                // is further.
                            )
                        ) {
                            nextpoint = i2;
                            lowestangle = angle;
                        };
                    }
                };
            }
            if(nextpoint === outline[0] || nextpoint === null) {
                loopexit = true;
            }
            else if(!compareobject(currpoint, _points[nextpoint])) {
                outline.push(nextpoint);
                taken[nextpoint] = true;
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
function perfectsphere(fineness) {
// returns a sphere with perfectly even point distribution. adjacent points are
// always the same distance from each other. compared to a latitude/longitude
// sphere, the same number of points will get you a rounder shape.
// - divide a sphere in eighths by slicing it in half on each axis.
// - that divides the surface into sorta-triangular thingies,
//   right...
// - the more you subdivide those, the rounder the sphere. fineness is how many
//   segments each quater-curve is broken up into.
// =
// - icospheres are usually better, because "perfect" spheres show seams that
//   unnaturally show how it's oriented. but that isn't a problem for me, since
//   i'm just using this in Raster.from3d and stuff like that.
    let i1 = 0;
    let i2 = 0;
    fineness = Math.floor(fineness);
    fineness = Number.isInteger(fineness) && fineness > 0 ? fineness : 1;
    let one = false;
    // used for testing. makes it return only one eighth of the sphere. (one
    // *complete* eighth, with all sides and corners.)
    let sphere = one ? Basis.new() : [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1]
    ];
    for(i1 = 0; i1 < fineness*(one ? 1 : 4); i1++) {
        if(i1%fineness) {
            sphere.push([
                Math.cos(2*Math.PI*i1/(fineness*4)),
                Math.sin(2*Math.PI*i1/(fineness*4)),
                0
            ]);
        }
    }
    // fill the xy ring
    let tri = [];
    for(i1 = 1; i1 < fineness; i1++) {
    // - for this loop, all we're making is the right, bottom, front triangle.
    // - reasons why it skips around so weirdly:
    //   - i1 === 0 would just be [0, 0, 1], which was already filled
    //   - i1 === fineness would be the xy ring, already filled (did that ahead
    //     of time so it wouldn't have inverted copies)
    //   - i1 === i2 would be the counterclockwise leg of the next triangle
    //   - i1 > i2 is outside the triangle.
        let temp = (Math.PI/2)*i1/fineness;
        let point = [Math.sin(temp), 0, Math.cos(temp)];
        // xz rotation
        for(i2 = 0; i2 < i1 + !!one; i2++) {
            temp = Point2.rotate([point[0], point[1]], (Math.PI/2)*i2/i1);
            tri.push([temp[0], temp[1], point[2]]);
            // xy rotation
        }
    }
    for(i1 = 0; i1 < (one ? 1 : 4); i1++) {
        for(i2 = 0; i2 < tri.length; i2++) {
            let temp = i1 ? Point2.rotate([tri[i2][0], tri[i2][1]], i1*Math.PI/2) : tri[i2];
            sphere.push([temp[0], temp[1], tri[i2][2]]);
            if(!one) {
                sphere.push([temp[0], temp[1], -tri[i2][2]]);

            }
        }
    }
    // add the tri and a z-inverted version of the tri, then do it again for
    // all 90 degree rotations.
    return sphere;
};
let perfectsphere_length = (fineness) => (
    6
    +
    12*Math.max(0, fineness - 1)
    +
    8*(Math.max(0, fineness - 2) + 1)*Math.max(0, fineness - 2)/2
);
// for math.
// - ...wait, you could just use perfectsphere(fineness).length. it'd be slower,
//   but it's not like that matters if you're just using it to figure out what
//   the default fineness should be...
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
    let i3 = 0;
    fineness = Number.isInteger(Math.round(fineness)) ? fineness : 4;
    // avoid non-numbers and values like Infinity or NaN
    //console.log(new Date().valueOf());
    if(fineness !== 0) {
        fineness = Math.round(Math.abs(fineness));
    };
    const circle = [];
    for(i1 = 0; i1 < fineness; i1++) {
        circle.push([
            Math.cos(2*Math.PI*i1/fineness),
            Math.sin(2*Math.PI*i1/fineness)
        ]);
    }
    const sphere = fineness === 0 ? null : perfectsphere(fineness);
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
                                    within[coor[0]][coor[1]].push(i3);
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
                shape.push([
                    sphere[i1][0]*w/2,
                    sphere[i1][1]*h/2,
                    sphere[i1][2]*d/2
                ]);
            }
            // scale it
            shape = orient ? Quat.orient(orient, shape) : shape;
            // orient the points of the sphere, relative to its center
            for(let i1 = 0; i1 < sphere.length; i1++) {
                shape[i1] = [
                    Math.trunc(offset[0] + shape[i1][0]),
                    Math.trunc(offset[1] + shape[i1][1]),
                    Math.trunc(offset[2] + shape[i1][2])
                ];
            }
            // add the coordinates
            return shape;
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
    fromnum: (r, g, b, a) => Color.from255(...Points.round(Points.multiply(typeof a === "number" ? [r, g, b, a] : [r, g, b], 255))),
    from255: function(r, g, b, a) {
        const digits = "0123456789abcdef";
        return (
            "#"
            + digits[Math.floor(r/16)] + digits[r%16]
            + digits[Math.floor(g/16)] + digits[g%16]
            + digits[Math.floor(b/16)] + digits[b%16]
            + (typeof a === "number" ? digits[Math.floor(a/16)] + digits[a%16] : "")
        );
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
    absencemultiply: (r1, g1, b1, r2, g2, b2) => [
        1 - (1 - r1)*(1 - r2),
        1 - (1 - g1)*(1 - g2),
        1 - (1 - b1)*(1 - b2)
    ],
    // useful for making color 1 brighter than it is, using color 2. expects 0
    // to 1 numbers.
    // - if 1 is gray, and 2 is orange...
    // - 1 - (1 - .5)*(1 - 1) | 1 - (1 - .5)*(1 - .5) | 1 - (1 - .5)*(1 - 0)
    // - 1 - .5*0 | 1 - .5*.5 | 1 - .5*1
    // - 1 | .75 | .5
};
const Raster = {
// pseudoclass for an array that represents an image. each value is the color of
// a pixel.
// - used in aa.
    fullellipse: function(w, h) {
    // generates an ellipse image.
        let _this = [];
        let rect = Rect.new(0, 0, w, h);
        for(let i1 = 0; i1 < w*h; i1++) {
            let coor = Raster.indextocoord(i1, rect);
            _this[i1] = Number(Math.hypot(
                2*Math.abs((coor[0] + .5)/w - .5),
                2*Math.abs((coor[1] + .5)/h - .5)
            ) < 1);
            // - x, y
            // - make it the center of the pixel: += .5
            // - make them 0 to 1 numbers: /= dim
            // - make them 0 if they're at the center, 1 if they're at the edge:
            //   -= .5, abs, *= 2
        }
        return _this;
    },
    capsule: function(x1, y1, x2, y2, r) {
    // returns the pixel coverage of a capsule shape.
    // - that is, two tangented circles.
    // - returns {x, y, w, h, raster}.
        let temp = [
            [x1 - r, x1 + r, x2 - r, x2 + r],
            [y1 - r, y1 + r, y2 - r, y2 + r]
        ];
        let rect = Rect.fromedges(
            Math.floor(Math.min(...temp[0]) - 1),
            Math.ceil(Math.max(...temp[0]) + 1),
            Math.floor(Math.min(...temp[1]) - 1),
            Math.ceil(Math.max(...temp[1]) + 1)
        );
        temp = [x2 - x1, y2 - y1];
        let length = Math.hypot(...temp);
        let angle = length ? get2dangle(...temp) : 0;
        let raster = [];
        for(let y = rect.y; y < rect.y + rect.h; y++) {
            for(let x = rect.x; x < rect.x + rect.w; x++) {
                let dist = [x - x1, y - y1];
                if(
                    (Math.hypot(...dist) <= r + .5)
                    ||
                    (Math.hypot(x - x2, y - y2) <= r + .5)
                ) {
                    raster.push(true);
                }
                else {
                    dist = Point2.rotate(dist, -angle);
                    raster.push(dist[0] >= 0 && dist[0] <= length && Math.abs(dist[1]) <= r + .5);
                }
            }
        }
        return {x: rect.x, y: rect.y, w: rect.w, h: rect.h, raster};
    },
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
                const point = rotate(
                    [
                        i1%w,
                        Math.floor(i1/w),
                        0
                    ],
                    "xy",
                    angle,
                    [x, y, 0]
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
                text += "-%*"[Number(_this[i1])];
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
    findcoor: (_this, rect, x, y) => (
        (x < Rect.l(rect) || x >= Rect.r(rect) || y < Rect.u(rect) || y >= Rect.d(rect)) ? null :
        _this[rect.w*(y - rect.y) + (x - rect.x)]
    ),
    _2dPoly: function(_this, rect, multiple) {
    // converts a raster into a series of points forming a closed shape
    // - multiple: by default, it only returns a single shape, even if
    //   the raster contains multiple closed shapes. it uses
    //   _2dPoly.convexed to make it.
        let i1 = 0;
        let i2 = 0;
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
        if(!multiple) {
            return _2dPoly.convexed(outline);
        }
        const dircoor = [];
        for(let dir = 0; dir < 8; dir++) {
            dircoor[dir] = [
                0 + (posmod(dir - 7, 8) <= 2) - (posmod(dir - 3, 8) <= 2),
                0 + (posmod(dir - 1, 8) <= 2) - (posmod(dir - 5, 8) <= 2)
            ];
        }
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
                if(outline.hasOwnProperty(i1) && !shape.length) {
                    for(i2 in outline[i1]) {
                        if(outline[i1].hasOwnProperty(i2) && !shape.length && !outline[i1][i2]) {
                        // start the shape with the first point you see
                        // that isn't taken.
                            shape[0] = [Number(i1), Number(i2)];
                            outline[i1][i2] = true;
                        }
                    }
                }
            }
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
                let x = shape[shape.length - 1][0];
                let y = shape[shape.length - 1][1];
                loopexit = true;
                // gets turned off if there was a new point
                for(i1 = 0; i1 < 8; i1++) {
                // search every direction
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
            }
            return shape;
        };
        let shapes = [];
        // array of _2dPolys
        let loopexit = false;
        for(; !loopexit;) {
            shapes[shapes.length] = addshape();
            // adds a closed shape
            if(!shapes[shapes.length - 1]) {
            // means there's no points left to make a closed shape with
                shapes.splice(shapes.length - 1, 1);
                loopexit = true;
            }
        }
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
        fineness ??= 4;
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
        }
        data = _2dPoly.mergedata(data);
        let rect = structuredClone(data.rect);
        let raster = [];
        for(i1 = 0; i1 < data.within.length; i1++) {
            raster[i1] = Number(data.within[i1]);
        }
        for(i1 = 0; i1 < _points.length; i1++) {
            for(i2 = 0; i2 < _points[i1].length; i2++) {
                let index = Rect.getindex(rect, ..._points[i1][i2].slice(0, 2));
                if(index === -1) {
                // out of bounds
                    console.log("this shouldn't happen (out of bounds Raster.from3d vertex.)");
                }
                else if(_points[i1][i2].length < 4) {
                // skip if it's a spheroid.
                    raster[index] = 2;
                }
                //
                /*
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
                //*/
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
    round: (point) => Points.applyfunc(point, Math.round),
    rand: function(range, snap) {
        range ??= 1;
        let point = [];
        for(let i1 = 0; i1 < 3; i1++) {
            point[i1] = Math.random()*(range + (snap ? 1 : 0));
            if(snap) {
                point[i1] = Math.trunc(point[i1]);
            }
        }
        return point;
    },
    centroid: function(points) {
        let center = [];
        for(let i1 = 0; i1 < points.length; i1++) {
            if(i1 && points[i1].length !== center.length) {
                console.log("inconsistent number of coordinates.");
                return;
            };
            for(let i2 = 0; i2 < points[i1].length; i2++) {
                center[i2] = (center[i2] ?? 0) + points[i1][i2];
            }
        }
        return Points.divide(center, points.length);
    },
};
let Point2 = {
// stores operations that only make sense for 2d points.
    rotate: function(point, angle, center) {
        center ??= [0, 0];
        let _point = Points.subtract(point, center);
        let cos = Math.cos(angle);
        let sin = Math.sin(angle);
        if(angle%(Math.PI/2) === 0) {
            cos = Math.round(cos);
            sin = Math.round(sin);
        };
        _point = [
            cos*_point[0] - sin*_point[1],
            cos*_point[1] + sin*_point[0],
        ];
        // (cos + sin*i)*(x + y*i) = new point (turn
        // the real number into the first axis coordinate and the i into
        // the second)
        // - i^2 = -1, so [cos*x - sin*y, cos*y + sin*x]
        // - this is called the "complex number" method of rotation.
        return Points.add(_point, center);
    },
    stretch: (point, angle, num, center) => Point2.rotate(
        Points.multiply(
            Point2.rotate(point, -angle, center),
            [num, 1]
        ),
        angle, center
    ),
    // stretches it along the specified angle.
    // - inverse rotate so the angle aligns with 0
    // - multiply x
    // - rotate back
}
class Viewer {
// a class for applying perspective.
// - range: the number of pixels from a point 0 degrees from the vanishing
//   point, to 180 degrees.
//   - this used to be "ratio", a number of pixels per degree. ...if that shows
//     up anywhere, remember that that would be equivalent to this.range/180.
// - x, y: the position of the vanishing point onscreen.
// - z: how far away the viewer is
// - disabled: obvious
    constructor(range, x, y, z, disabled) {
        this.range = typeof range === "number" ? range : 180;
        this.x = typeof x === "number" ? x : 0;
        this.y = typeof y === "number" ? y : 0;
        this.z = typeof z === "number" ? z : 0;
        this.disabled = !!disabled;
    }
    static fromobj(obj) {
        return (
            typeof obj === "object"
            ?
            new Viewer(obj.range ?? null, obj.x ?? null, obj.y ?? null, obj.z ?? null, obj.disabled ?? null)
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
            num = num*(this.range/Math.PI) + vp;
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
		x /= this.range/Math.PI;
		y /= this.range/Math.PI;
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
			// z is negative because of how convert uses viewer.z - z, when x
			// and y are _ - viewer._
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
		temp *= this.range/Math.PI;
		// convert to degrees
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
		let target = Math.PI/this.range;
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
        return rotate(points, this.angle, angle, [this.x, this.y, this.z]);
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
    cone_intersect(tip, basis, xr, yr, h) {
    // finds the intersections of a line and a double-cone, if they exist.
    // - basis' z axis is used to find the tip-to-base direction, and the x/y
    //   axes are the perpendicular directions that xr and yr apply to.
    //   - xr/yr stand for "x/y radius".
    //   - NOTE: basis is assumed to be "perfect", with each axis having a
    //     hypotenuse of 1 and being perpendicular to the other axes. use a
    //     quaternion and Quat.basis.
    //     - the only reason it isn't a quaternion is so i can invert axes.
    // - this does not return an array of points, but objects.
    //   - point: coordinates of the intersection
    //   - angle: the point's 2d angle on the basis' xy plane.
    //   - line_place: where it is on the line
    //     - 0 if it's right at the line origin
    //     - 1 if it's one away in direction of the angle
    //     - -1 if it's one away in the opposite direction
    //   - cone_place: where it is on the cone's central line, 0 being the tip
    //     and 1 being 1 unit up along the z axis.
    //   - exit: whether the intersection is from the inside out. (it assumes
    //     the line is like a bullet fired in the line.angle and the opposite
    //     angle, from the line origin.)
    	let line = this;
    	let start = Points.convert(line);
    	start = Points.subtract(start, tip);
    	// make it relative to the cone tip, so we don't have to account for
    	// that in the cone equation (doing that isn't impossible, but it's
    	// annoying.)
    	let inverse = Basis.invert(basis);
    	start = Basis.apply(inverse, start);
    	let vect = Angle.numbers(line.angle);
    	vect = Basis.apply(inverse, vect);
    	// orientation makes things too complicated. it's easier to pretend it's
        // totally unrotated, and apply the orientation to the intersections at
        // the end... but what matters is where the line's position and angle is
        // relative to the cone. ignoring orientation is like subtracting it...
        // so we subtract it from the line too.
    	// =
    	// the equation of a cone is x^2 + y^2 = z^2.
    	// - then if you replace each axis letter with like, ((x - tip[0])/xr),
    	//   (use h for z.)
    	// - the tip will be where it should be, and the cone will be
    	//   dimensioned so that h away from the tip, the x/y radii will be
    	//   xr/yr.
    	// =
    	// if you think of a line as a parametric equation, it'd be x = start[0]
        // + place*vect[0].
    	// - rinse and repeat for y, z
    	// - if you use those expressions in place of the axis variables in the
        //   cone equation, you can simplify it into an expression of 0 =
    	//   a*place^2 + b*place + c.
    	// - so, a quadratic expression you can use to solve for "place": two
        //   numbers for how many units of vect the intersections are from
    	//   start.
    	// =
    	/*
    	((vect*place + start)/dim)^2
    	(
    		((vect/dim)^2)*(place^2)
    		+
    		(2*start*vect/(dim^2))*place
    		+
    		(start/dim)^2
    	)
    	(
    		a = (vect/dim)^2
    		b = 2*start*vect/(dim^2)
    		c = (start/dim)^2
    	)
    	*/
    	let a = 0;
    	let b = 0;
    	let c = 0;
    	for(let i1 = 0; i1 < 3; i1++) {
    		let dim = i1 === 0 ? xr : i1 === 1 ? yr : i1 === 2 ? h : NaN;
    		let sign = i1 === 2 ? -1 : 1;
    		a += sign*(vect[i1]/dim)**2;
    		b += sign*2*start*vect/(dim**2);
    		c += sign*(start[i1]/dim)**2;
    	}
    	// - x stuff + y stuff = z stuff
    	// - but we want the right side to be zero so it can be solved. make it
    	//   x + y - z.
    	let qf = b**2 - 4*a*c;
    	if(qf < 0) {
    		return [];
    	};
    	qf = [
    		-b,
    		Math.sqrt(qf),
    		2*a
    	];
    	let place = [
    		(qf[0] - qf[1])/qf[2],
    		(qf[0] + qf[1])/qf[2]
    	];
    	// quadratic formula.
    	// - if b^2 - 4ac is negative, there's no intersections.
    	// - they played us this lame ass song in math class to help us memorize
        //   it.
    	// - god bless the people that made that song, i have never failed to
        //   remember it since.
        let intersect = [];
    	for(let i1 = 0; i1 < 2; i1++) {
    		let point = Points.multiply(vect, place[i1]);
    		point = Points.add(start, point);
    		// convert the line place to a real point
            let angle = get2dangle(point[0]/xr, point[1]/yr, true);
    		let cone_place = point[2];
    		point = Basis.apply(basis, point);
    		// apply orientation (do it before adding tip, so tip is the
            // fulcrum.)
    		point = Points.add(tip, point);
    		// the coordinates are relative to the tip, fix that.
    		intersect[i1] = {
    			point,
                angle,
    			line_place: place[i1],
    			cone_place,
                exit: false,
    		};
    	}
        if(place[0] && Math.sign(place[0]) === -Math.sign(place[1])) {
        // if one place is negative and the other is positive, that means either
        // they're both exits, or both entries.
            intersect[0].exit = (
                Math.hypot(
                    start[0]/xr,
                    start[1]/yr
                )
                <
                Math.abs(start[2]/h)
            );
            // this will be true if it's inside the cone.
            // - the start is already relative to the cone tip, and the cone's
            //   orientation is already cancelled out. so cancel out the
            //   dimensions to turn it into a textbook x^2 + y^2 <= z^2 cone.
            intersect[1].exit = intersect[0].exit;
        }
        else {
        // otherwise, the one with a higher absolute value is an exit.
            let temp = Math.abs(intersect[1].line_place) > Math.abs(intersect[0].line_place);
            intersect[Number(temp)].exit = true;
        };
    	return intersect;
    }
    cyl_intersect(top, basis, xr, yr) {
    // read the comments for cone_intersect. this is almost the same process.
    	let line = this;
    	let start = Points.convert(line);
    	start = Points.subtract(start, top);
    	// make it relative to top, so we don't have to account for that later
    	let inverse = Basis.invert(basis);
    	start = Basis.apply(inverse, start);
    	let vect = Angle.numbers(line.angle);
    	vect = Basis.apply(inverse, vect);
    	// cancel out orientation
    	// =
    	// the equation of a cylinder is (x/xr)^2 + (y/yr)^2 = 1.
    	// - then, do the same stuff we did in cone_intersect.
    	// - a = (vect/dim)^2
    	// - b = 2*start*vect/(dim^2)
    	// - c = (start/dim)^2
    	let a = 0;
    	let b = 0;
    	let c = -1;
    	for(let i1 = 0; i1 < 2; i1++) {
    		let dim = i1 === 0 ? xr : i1 === 1 ? yr : NaN;
    		a += (vect[i1]/dim)**2;
    		b += 2*start*vect/(dim**2);
    		c += (start[i1]/dim)**2;
    	}
    	// - x stuff + y stuff = 1
    	// - set it equal to zero by subtracting 1 from c
    	let qf = b**2 - 4*a*c;
    	if(qf < 0) {
    		return [];
    	};
    	qf = [
    		-b,
    		Math.sqrt(qf),
    		2*a
    	];
    	let place = [
    		(qf[0] - qf[1])/qf[2],
    		(qf[0] + qf[1])/qf[2]
    	];
    	// quadratic formula.
        let intersect = [];
    	for(let i1 = 0; i1 < 2; i1++) {
    		let point = Points.multiply(vect, place[i1]);
    		point = Points.add(start, point);
    		// convert the line place to a real point
            let angle = get2dangle(point[0]/xr, point[1]/yr, true);
    		let cyl_place = point[2];
    		point = Basis.apply(basis, point);
    		// apply orientation (do it before adding top, so top is the
            // fulcrum.)
    		point = Points.add(top, point);
    		// the coordinates are relative to the top, fix that.
    		intersect[i1] = {
    			point,
                angle,
    			line_place: place[i1],
    			cyl_place,
                exit: false,
    		};
    	}
        if(place[0] && Math.sign(place[0]) === -Math.sign(place[1])) {
        // if the signs are negative and positive, they're both exits.
        // - cone_intersect deals with a double-cone, which is concave. for a
        //   totally convex shape, it's impossible to intersect it twice from
        //   opposite directions from outside.
            intersect[0].exit = true;
            intersect[1].exit = true;
        }
        else {
        // otherwise, the higher absolute value is the exit.
            let temp = Math.abs(intersect[1].line_place) > Math.abs(intersect[0].line_place);
            intersect[Number(temp)].exit = true;
        };
    	return intersect;
    }
}
class Plane {
// class for defining a 2d plane in 3d space through a modifier for each
// axis, and an offset. points are on the plane if multiplying each
// coordinate by the plane's modifier and adding the plane's offset equals
// 0.
    constructor(x, y, z, offset) {
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
    line() {
    // returns a new Line that's perpendicular to this plane and intersects at
    // this.origin.
    // at the point specified.
    // - uses planepoint.
        return new Line(...this.origin(), Angle.get(this.x, this.y, this.z));
    }
    linefrompoint(coord1, coord2, missingaxis, shush) {
    // returns a new Line that's perpendicular to this plane and intersects
    // at the point specified.
    // - uses planepoint.
        return new Line(...this.planepoint(coord1, coord2, missingaxis, shush), Angle.get(this.x, this.y, this.z));
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
//   it's more trouble than it's worth. the only reason i wanted a class was
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
            get2dangle(x, y, true) ?? 0,
            get2dangle(Math.hypot(x, y), z, true),
        ];
        if(angle[1] === null) {
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
    numbers: function(_this) {
    // gives numbers equivalent to cos and sin, but for 3d. numbers between
    // -1 and 1, that represent where a point on a sphere of 1 radius would
    // be.
    // - satellite: if true, this will return two points, one of them being
    //   the angle numbers of the rolldirection plus the original angle
    //   numbers
        return [
            Math.cos(_this[0])*Math.cos(_this[1]),
            Math.sin(_this[0])*Math.cos(_this[1]),
            Math.sin(_this[1])
        ];
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
    invert: function(_this) {
    // creates an angle that points in the opposite direction.
        return (
            typeof _this === "number"
            ?
            posmod(_this + Math.PI, 2*Math.PI)
            :
            [posmod(_this[0] + Math.PI, 2*Math.PI), -_this[1]]
        );
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
    rand: function() {
    // constructs a random angle.
        return [
            Math.random()*2*Math.PI,
            (Math.random() - .5)*Math.PI
        ];
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
let Basis = {
// pseudoclass. look up what a basis is if you don't know.
// - *remembers what happened every time i tried to look up math concepts i
//   never learned about* or email me if you don't know,
    new: () => [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ],
    apply: (_this, point) => [
        point[0]*_this[0][0] + point[1]*_this[1][0] + point[2]*_this[2][0],
        point[0]*_this[0][1] + point[1]*_this[1][1] + point[2]*_this[2][1],
        point[0]*_this[0][2] + point[1]*_this[1][2] + point[2]*_this[2][2]
    ],
    // [0][0]: "one unit of x translates to this much x"
    // [0][1]: "one unit of x translates to this much y"
    // [1][0]: "one unit of y translates to this much x"
    // etc.
    check: function(_this) {
    // checks if all three are 90 degrees from each other.
        let i1 = 0;
        let angles = [];
        let errors = [];
        for(i1 = 0; i1 < 3; i1++) {
            angles[i1] = Angle.get(..._this[i1]);
            let hypot = Math.hypot(..._this[i1]);
            if(roundspecial(hypot - 1)) {
                errors[errors.length] = "invalid " + "xyz"[i1] + " length: " + hypot;
            };
        }
        for(i1 = 0; i1 < 3; i1++) {
            let compare = Angle.compare(angles[i1], angles[(i1 + 1)%3]);
            if(roundspecial(compare - Math.PI/2)) {
                errors[errors.length] = "invalid " + "xyz"[i1]  + "/" + "xyz"[(i1 + 1)%3] + " angle: " + compare;
            }
            angles[i1] = Angle.get(..._this[i1]);
        }
        return errors.join("\n");
    },
    invert: (_this) => [
    // if you apply a basis to a point, applying an inverse of that basis will
    // revert it.
    // xx xy xz
    // yx yy yz
    // zx zy zz
        [_this[0][0], _this[1][0], _this[2][0]],
        [_this[0][1], _this[1][1], _this[2][1]],
        [_this[0][2], _this[1][2], _this[2][2]]
    ],
};
let Quat = {
// quaternion pseudoclass. don't bother looking too hard into this,
// quaternions are super fucked up!
// - do you have any idea how long it took to find good resources for this?
//   - check out the 3Blue1Brown youtube channel and the multiplication
//     table at the top of the quaternion wikipedia page. it's pretty hard
//     to figure out even then.
// - NOTE: there is a special, original property, "flip".
//   - it's a boolean that just means, when you're using it to make a basis or
//     orient a point, you should invert all coordinates.
//   - that's because this is the only way to create a quaternion that's x
//     mirrored, y mirrored, etc.
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
            flip: false,
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
            flip: invertboolean(_this.flip, quat.flip),
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
    // creates a quaternion that does the opposite of what the given quaternion
    // does. (ie: applying the both original and this should leave it
    // unchanged.)
        return {
            w: _this.w,
            x: -_this.x,
            y: -_this.y,
            z: -_this.z,
            flip: _this.flip,
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
            flip: false,
        });
        temp = Quat.local_multiply(temp, Quat.invert(_this));
        temp = [
            temp.x,
            temp.y,
            temp.z
        ]
        return _this.flip ? Points.multiply(temp, -1) : temp;
    },
    basis: (_this) => [
        Quat.apply(_this, [1, 0, 0]),
        Quat.apply(_this, [0, 1, 0]),
        Quat.apply(_this, [0, 0, 1])
    ],
    // creates a basis, a set of three three-coordinate points representing
    // how much x/y/z a unit of x, y, or z should translate to.
    orient: function(_this, points) {
    // apply the quaternion to multiple points at once. (for example,
    // orienting a 3d shape)
        let basis = Quat.basis(_this);
        let _points = [];
        for(let i1 = 0; i1 < points.length; i1++) {
            _points[i1] = Basis.apply(basis, points[i1]);
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
            flip: _this.flip,
        };
    },
    magnitude: (_this) => 2*Math.acos(_this.w),
    axis: (_this) => Quat.axis_magnitude(_this).axis,
    axis_magnitude: function(_this) {
        let magnitude = Quat.magnitude(_this);
        let axis = Math.sin(magnitude);
        if(axis && (_this.x || _this.y || _this.z)) {
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
        "z: " + _this.z,
        "flip: " + _this.flip
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
        &&
        typeof _this.flip === "boolean"
    ),
    dot: (quat1, quat2) => quat1.w*quat2.w + quat1.x*quat2.x + quat1.y*quat2.y + quat1.z*quat2.z,
    slerp: function(quat1, quat2, num) {
    // 0 makes something like quat1, 1 makes something like quat2.
    // - NOTE: remember to normalize it.
    // - NOTE: if quat1 and quat2 have different .flip, flip will change
    //   arbitrarily at .5. ...that isn't exactly ideal, but flip isn't a very
    //   animatable property to begin with. just bear in mind that flip to !flip
    //   transitions will look kind of stupid.
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
            flip: (num < .5 ? quat1 : quat2).flip,
        };
    },
    rand: () => Quat.new(Angle.rand(), 2*Math.PI*Math.random()),
    mirror: {
        x: function(_this) {
        // rotates and flips it so that the basis' x coordinates are the opposite of
        // what they were before.
            if(!_this) {
                return {w: 0, x: 1, y: 0, z: 0, flip: true};
            };
            let quat = Quat.rotate(_this, "yz", Math.PI);
            // 180 degree rotation is equivalent to inverting two axes. rotating 180
            // yz wil invert the y and z.
            quat.flip = !quat.flip;
            // then, inverting the flip will invert ALL axes. y and z go back to
            // normal, leaving only x inverted. elegant.
            return quat;
        },
        y: function(_this) {
            if(!_this) {
                return {w: 0, x: 0, y: -1, z: 0, flip: true};
            };
            let quat = Quat.rotate(_this, "xz", Math.PI);
            quat.flip = !quat.flip;
            return quat;
        },
        z: function(_this) {
            if(!_this) {
                return {w: 0, x: 0, y: 0, z: 1, flip: true};
            };
            let quat = Quat.rotate(_this, "xy", Math.PI);
            quat.flip = !quat.flip;
            return quat;
        },
        multi: function(_this, x, y, z) {
            let quat = structuredClone(_this ?? Quat.new());
            let invert = (x ? "x" : "") + (y ? "y" : "") + (z ? "z" : "");
            if(invert.length === 3) {
                quat.flip = !quat.flip;
            }
            else if(invert.length === 2) {
                quat = Quat.rotate(quat, invert, Math.PI);
            }
            else if(invert.length === 1) {
                quat = Quat.mirror[invert](quat);
            };
            return quat;
        },
    },
    flipped: function(_this) {
        let quat = structuredClone(_this);
        quat.flip = !quat.flip;
        return quat;
    },
};


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
        //   replaced with AAX.Color.part_fill.
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
        mirror: "body_exclusive",
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
        // - orient: orientation quaternion, modified by the rotate or tilt
        //   pose tools.
        // - stretch, widen: scale factors. stretch expands it along the line
        //   to the parent, widen expands it in the other directions.
        //   - if stretch isn't applicable, (parent and child are on the same
        //     spot, or parent is standpoint) widen is used as an overall scale
        //     factor.
        // - mirror: boolean for whether this is the mirrored counterpart of
        //   another part. if so, orient has to have Quat.mirror.x run on it
        //   when a Part is made.
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
    shape_templates: {
    // most of these will be created from AAX.Body.templates.standard, in
    // AAX.initialize.
        sphere: `0, 0, 0, 8`,
    },
    body_read: {
    // an object of functions used in Body.new and body maker.
        comment_char: "//",
        uncomment: (text) => uncomment(text, AAX.body_read.comment_char, "\n", true),
        family: function(text) {
        // reads a family-defining text field and converts it to an object of
        // {parent, x, y, z} objects.
        // - if there's an input error, it'll return a string describing it.
            let i1 = 0;
            text = AAX.body_read.uncomment(text).split("\n");
            let array = [];
            let lowest = Infinity;
            for(i1 = 0; i1 < text.length; i1++) {
                let line = text[i1];
                let index = line.indexOf(":");
                if(!line.trim()) {
                    // make sure it doesn't error from lines that have nothing
                    // but comments
                }
                else if(index === -1) {
                    return "invalid input. a line in the family defining has no colon.";
                }
                else {
                    let num = line.length - line.trimStart().length;
                    lowest = Math.min(lowest, num);
                    let name = line.slice(num, index);
                    if(name === "standpoint") {
    					return "invalid input. \"standpoint\" is a reserved word.";
    				}
    				else if(name in AAX.Body.prototype) {
    				// matches an object/Body method/property. (ex: making a part
                    // called "hasOwnProperty" will cover up the hasOwnProperty
                    // method and make it unusable)
    					return "invalid input. \"" + name + "\" is an invalid part name for technical reasons.";
    				}
                    array.push({
                        name,
                        num,
                        content: line.slice(index + ":".length),
                    })
                }
            }
            for(i1 = 0; i1 < array.length; i1++) {
                array[i1].num -= lowest;
                array[i1].num = Math.min(array[i1].num, (i1 ? array[i1 - 1].num + 1 : 0));
            }
            let family = {};
            let error = "";
            function addbranch(index, parent) {
                let name = array[index].name;
                let num = array[index].num;
                if(name in family) {
                    error = "invalid input. there is more than one part named \"" + name + "\".";
                    return;
                };
                let coor = AAX.strings.coor(array[index].content, .5);
                if(!coor) {
                    error = "invalid input. the " + name + " part has invalid coordinates. it must be three numbers.";
                    return;
                };
                family[name] = {parent, x: coor[0], y: coor[1], z: coor[2]};
                for(let i1 = index + 1; i1 < array.length; i1++) {
                    let _num = array[i1].num - num;
                    if(_num === 1) {
                    // direct child
                        addbranch(i1, name);
                        if(error) {
                            return;
                        }
                    }
                    else if(_num <= 0) {
                    // sibling or something
                        i1 += array.length;
                    }
                }
            }
            for(i1 = 0; i1 < array.length; i1++) {
                if(array[i1].num === 0) {
                    addbranch(i1, "standpoint");
                    if(error) {
                        return error;
                    }
                }
            }
            return family;
        },
        image_split: function(text) {
        // splits up an image_text field into an object indexed by part name.
            text = text.split("\n");
            let name = "";
            let obj = {};
            for(let i1 = 0; i1 < text.length; i1++) {
                let line = AAX.body_read.uncomment(text[i1]).trim();
                if(line.startsWith("[") && line.endsWith("]")) {
                // name change
                    name = line.slice(1, -1).trim();
                }
                else if(name) {
                    obj[name] ??= "";
                    obj[name] += (obj[name] ? "\n" : "") + text[i1];
                    // don't use line. there's no reason to keep the
                    // comments sliced out.
                }
            }
            return obj;
        },
        extra_split: function(text) {
            text = text.split("\n");
            let name = "";
            let obj = {};
            for(let i1 = 0; i1 < text.length; i1++) {
                let line = AAX.body_read.uncomment(text[i1]).trim();
                let _line = text[i1];
                let namechange = line.includes(":");
                if(namechange) {
                // name change
                    let index = line.indexOf(":");
                    name = line.slice(0, index).trim();
                    line = line.slice(index + 1).trim();
                    _line = _line.slice(_line.indexOf(":") + 1);
                    // _line exists because i need an unaltered copy of the
                    // line, but i also need to slice out the name/colon if
                    // it's gonna be added to extra_text. how annoying.
                };
                if(name && (!namechange || line)) {
                // it's fine to keep in empty lines, so it stays mostly the
                // same as the input. but if it's the line with the colon,
                // no.
                    obj[name] ??= "";
                    obj[name] += (obj[name] ? "\n" : "") + _line.trim();
                };
            }
            return obj;
        },
        collect: function(text) {
        // coalesces several of these functions into one interpretation that
        // returns {parent, x, y, z, image_text, extra_text} objects.
        // - from there, it can be converted into a Body, or a body maker
        //   bodydata object.
        // - returns a string if it runs into errors.
            let i1 = 0;
            let i2 = 0;
            text = text.split("\n###\n");
            let data = AAX.body_read.family(text[0]);
            if(typeof data === "string") {
                return data;
            };
            // field 1: family tree (names, parenting, coordinates)
            let empty = true;
            for(i1 in data) {
                if(data.hasOwnProperty(i1)) {
                    empty = false;
                    data[i1].image_text = "";
                    data[i1].extra_text = "";
                };
            }
            if(empty) {
                return "invalid input. there are no parts.";
            };
            for(i1 = 1; i1 < 3 && i1 < text.length; i1++) {
                let obj = (
                    i1 === 1 ? AAX.body_read.image_split(text[i1]) :
                    // field 2: shapes/images
                    i1 === 2 ? AAX.body_read.extra_split(text[i1]) :
                    // field 3: extra parameters (symmetry, silhouettes, hide,
                    // etc)
                    null
                );
                let temp = i1 === 1 ? "image" : i1 === 2 ? "extra" : null;
                for(i2 in obj) {
                    if(obj.hasOwnProperty(i2)) {
                        if(i2 in data) {
                            data[i2][temp + "_text"] = obj[i2];
                        }
                        else {
                            return "invalid input. the name \"" + i2 + "\" in the " + temp + " field doesn't match any body parts.";
                        };
                    }
                }
            }
            return data;
        },
        extra_commands: function(string) {
            //console.log(string);
            let i1 = 0;
            let i2 = 0;
            let comment = AAX.body_read.comment_char;
            let level = 0;
            let ranges = [];
            for(i1 = 0; i1 <= string.length; i1++) {
                let left = string.slice(0, i1);
                let right = string.slice(i1);
                if(right.startsWith(comment)) {
                // skip to the end of the comment.
                    let temp = right.indexOf("\n");
                    i1 += temp === -1 ? string.length + 1 : temp - 1;
                    // it's a comment if it's in or after a comment char but
                    // before a \n. (the \n doesn't count as part of the
                    // comment, i mean.)
                }
                else {
                    if(left.endsWith(")")) {
                        level--;
                        if(!level) {
                            ranges.push(i1);
                        }
                    };
                    if(right.startsWith("(")) {
                        if(!level) {
                            ranges.push(i1);
                        }
                        level++;
                    };
                }
            };
            let array = [];
            if(ranges.length%2) {
                ranges.splice(ranges.length - 1, 1);
            };
            for(i1 = 0; i1 < ranges.length; i1 += 2) {
                let name = string.slice(0, ranges[i1]);
                for(i2 = name.length - 1; i2 >= 0; i2--) {
                    if(!name[i2].trim()) {
                        name = name.slice(i2 + 1);
                        i2 = 0;
                    }
                }
                if(name) {
                    let start = ranges[i1] - name.length;
                    let end = ranges[i1 + 1] + 1;
                    array.push({
                        name,
                        // what kind of command it is
                        start, end,
                        // index ranges to slice out to remove this command
                        // entirely
                        content: AAX.body_read.uncomment(string.slice(ranges[i1] + 1, ranges[i1 + 1] - 1)),
                        // text inside the parentheses.
                    });
                }
            }
            //console.log(array);
            return array;
        },
        symmetry_prefixes: function(content) {
            content = content.split(",");
            content[1] ??= "";
            let prefix1 = content[0].trim() || AAX.prefix1;
            let prefix2 = content[1].trim() || AAX.prefix2;
            return prefix1 === prefix2 ? [AAX.prefix1, AAX.prefix2] : [prefix1, prefix2];
        },
    },
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
            let obj = AAX.body_read.collect(text);
            // {parent, x, y, z, image_text, extra_text} objects
            if(typeof obj === "string") {
            // or a string, if it screwed up somewhere.
                return obj;
            };
            for(i1 in obj) {
                if(obj.hasOwnProperty(i1)) {
                // uncomment
                    obj[i1].image_text = AAX.body_read.uncomment(obj[i1].image_text);
                    obj[i1].extra_text = AAX.body_read.uncomment(obj[i1].extra_text);
                }
            }
            //
			let has_shape = [];
			// array of the names of parts with non-default shapes.
			for(i1 in obj) {
				if(obj.hasOwnProperty(i1)) {
				// convert all images. if they don't have images, at least make
				// sure shape, image, and perspective objects are created.
				// - not gonna convert objects from text yet. can't do that
				//   until it can figure out AAX.image_oddness, which it can't do
				//   until it has perspective_coor filled.
					let part = obj[i1];
					let image = part.image_text;
					// shape/image defining code
					delete part.image_text;
					part.shape = {
						points: [],
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
                        image = image.split("||");
						// split into shape, unperspectived, and perspectived
                        for(i2 = 0; i2 < image.length; i2++) {
                            if(i2 === 0) {
                                image[i2] = image[i2].trim();
                            }
                            else {
                                image[i2] = image[i2].split("|");
                                for(i3 = 0; i3 < image[i2].length; i3++) {
                                    image[i2][i3] = image[i2][i3].trim();
                                }
                            }
                        }
                        // split further, and trim it
						if(image.length >= 1 && image[0]) {
						// if there's a shape
							let temp = AAX.strings.shape(image[0], obj, i1);
							if(temp) {
							// if it didn't error from invalid inputs, use that.
								part.shape = structuredClone(temp);
								has_shape.push(i1);
							}
						};
						if(image.length >= 2 && image[1]) {
						// if there's unperspectived images
                            if(image[1].length > 2) {
								return "invalid input. (there's more than two unperspectived images. the most there should be is a front image and right image.)";
							};
							if(image[1].length >= 1 && image[1][0]) {
								part.image.front = image[1][0];
							};
							if(image[1].length >= 2 && image[1][1]) {
								part.image.right = image[1][1];
							};
						};
						if(image.length >= 3 && image[2]) {
						// if there's perspectived images
                            if(image[2].length > 4) {
                                return "invalid input. (there's more than four perspectived images. the most there should be is one for each view.)";
                            };
							for(i2 = 0; i2 < image[2].length && i2 < 4; i2++) {
								if(image[2][i2]) {
									part.perspective[i2] = image[2][i2];
								};
							}
						}
						if(image.length > 3) {
							return "invalid input. (|| is used to divide shapes from unperspectived images and unperspectived images from perspectived images, but there's more than two for " + i1 + ".)";
						};
					};
				}
			};
			// by the end of this loop, part.image must exist, with
			// a front and right, filled either by null or by text.
            for(i1 in obj) {
				if(obj.hasOwnProperty(i1) && obj[i1].extra_text) {
                // run through all the possible commands extra_text can give.
                    let part = obj[i1];
                    //console.log(i1);
                    let commands = AAX.body_read.extra_commands(part.extra_text);
                    delete part.extra_text;
                    part.hide = false;
                    part.symmetry = null;
                    for(i2 = 0; i2 < commands.length; i2++) {
                        let ref = commands[i2];
                        let content = ref.content;
                        if(ref.name.startsWith("color")) {
                            const branch = !ref.name.endsWith("*");
                            const propertyname = branch ? "branch_" + ref.name : ref.name.slice(0, -1);
                            let temp = ref.name.slice("color".length);
                            if(temp === "1" || temp === "2" || temp === "1*" || temp === "2*") {
                            // branch_color, color
                                if(branch) {
                                    content = content.split(",");
                                    for(i3 = 0; i3 < content.length; i3++) {
                                        let num = Number(content[i3]);
                                        if(Number.isInteger(num) && num >= 0) {
                                            content[i3] = num;
                                        };
                                    }
                                    // numberize if possible
                                    if(content.length) {
                                        part[propertyname] = structuredClone(content);
                                    }
                                }
                                else {
                                    let num = Number(content);
                                    if(Number.isInteger(num) && num >= 0) {
                                        part[propertyname] = num;
                                    };
                                }
                            }
                        }
                        else if(ref.name === "silhouette" || ref.name === "silhouette*") {
                        // silhouette, branch_silhouette
                            const branch = !ref.name.endsWith("*");
                            let sub = 0;
                            // stands for "subgroup"
                            for(sub = content.length - 1; sub >= 0 && content[sub].toLowerCase() !== content[sub].toUpperCase(); sub--) {
                            // find the last non-letter character
                            }
                            sub++;
                            // so that it's at the end of that last non-letter, and
                            // can be used as a slice index
                            content = [
                                content.slice(0, sub),
                                content.slice(sub)
                            ];
                            let num = Number(content[0]);
                            sub = content[1];
                            if(!Number.isInteger(num) || num < 0) {
                                return "invalid input. (invalid silhouette group number. must be a positive integer.)";
                            };
                            part[(branch ? "branch_" : "") + "silhouette"] = [num, sub];
                        }
                        else if(ref.name === "perspective") {
                        // perspective.coor
                            content = content.split(",");
                            let coor = [
                                "auto",
                                "auto",
                                "auto",
                                "auto"
                            ];
                            let numofautos = 0;
                            for(i3 = 0; i3 < 4; i3++) {
                                let index = i3*2 - numofautos;
                                if(content[index] === "auto") {
                                    coor[i3] = "auto";
                                    numofautos++;
                                }
                                else {
                                    let num = [
                                        Number(content[index]),
                                        Number(content[index + 1])
                                    ];
                                    if(isNaN(num[0]) || isNaN(num[1])) {
                                        return "invalid input. (invalid perspective coordinates.)";
                                    }
                                    coor[i3] = structuredClone(num);
                                }
                            }
                            part.perspective.coor = structuredClone(coor);
                        }
                        else if(ref.name === "capsule") {
                        // capsule connections
                            content = AAX.posint(content);
                            if(isNaN(content)) {
                                return "invalid input. (invalid capsule width.)";
                            };
                            part.connection = {
                                type: ref.name,
                                value: content,
                            };
                        }
                        else if(ref.name === "generation") {
                        // generation connections
                            content = content.split(",");
                            content = [
                                Number(content[0]),
                                Number(content[1] ?? 0)
                            ];
                            if(!Number.isInteger(content[0]) || !Number.isInteger(content[1])) {
                                return "invalid input. (generation connections are supposed to be integers representing how many generations back/forward you want the part to connect to.)";
                            }
                            else {
                                part.connection = {
                                    type: ref.name,
                                    value: content,
                                };
                            }
                        }
                        else if(ref.name === "hide") {
                            part[ref.name] = true;
                        }
                        else if(ref.name === "symmetry") {
                            content = AAX.body_read.symmetry_prefixes(content);
                            part.symmetry = {
                                prefix1: content[0],
                                prefix2: content[1],
                            };
                        };
                    }
                }
            }
			//
			// text interpretation is done, time to convert it to a usable body.
			//
			let body = new AAX.Body();
			// final product
			for(i1 in obj) {
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
						part[ order[i2] ] = structuredClone( obj[i1][ order[i2] ] );
					};
                    part.mirror = false;
				}
			}
			// now that every body part exists, we can do stuff like
			// branch_color.
			function branchassign(body, part, property, values) {
			// assigns colors or silhouette groups to the named and to all its
			// descendants.
			// - values: an array of values to cycle through with every
			//   generation. (ie if it's [1, 2], the named part will be 1, all
			//   children will be 2, all grandchildren will be 1, etc)
				let i1 = 0;
				if(!Array.isArray(values)) {
					values = [values];
				}
				body[part][property] = structuredClone(values[0]);
				let temp = structuredClone(values[0]);
				values.splice(0, 1);
				values[values.length] = temp;
				// cycle through
				for (i1 in body) {
					if(body.hasOwnProperty(i1) && body[i1].parent === part) {
						branchassign(body, i1, property, structuredClone(values));
					};
				}
			};
            for(i1 in body) {
                if(body.hasOwnProperty(i1) && body[i1].parent === "standpoint") {
                // set the default colors/silhouette
                    branchassign(body, i1, "color1", [1, 2]);
                    branchassign(body, i1, "color2", [0]);
                    branchassign(body, i1, "silhouette", [[0, ""]]);
                }
            }
			for (i1 in body) {
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
				};
			}
			// a loop to set the branch stuff
			for (i1 in body) {
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
			// a loop to set the non-branch stuff
			function simpleshape(shape) {
			// if a shape is a single point, it returns that point.
				let point = null;
				for(let i1 = 0; i1 < shape.points.length; i1++) {
				// search every group
					for(let i2 = 0; i2 < shape.points[i1].length; i2++) {
					// search every point
						if(point !== null) {
						// this isn't the first point
							return null;
						}
						point = structuredClone(shape.points[i1][i2]);
					}
				}
				return point;
			}
			for (i1 in body) {
				if (body.hasOwnProperty(i1)) {
				// interpret images
					let part = body[i1];
					part.connection = structuredClone(obj[i1].connection ?? {type: "generation", value: [1, 0]});
					// done here so that it's right after silhouette.
					// - if it's absent, connect to parents.
					const oddness = AAX.oddness(body, i1);
					for(i2 = -2; i2 < 4; i2++) {
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
								//let rect = Raster.dimrect(...AAX.l_dim(image.length, old_oddness));
                                //image = AAX.sq_raster.squarify(image, rect);
								image = AAX.sq_raster.squarify(image, [w, h]);
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
									image[i3] = 0;
								}
								part.image[view] = Raster.ellipse(image, w, 0, 0, w - 1, h - 1);
							};
						};
					}
				}
			}
            //
            let order = AAX.getdesc(body);
            let symmetry = {};
            for(i1 = 0; i1 < order.length; i1++) {
                let _i1 = order[i1];
                if(obj[_i1].symmetry) {
                    symmetry[_i1] = {
                        prefix1: obj[_i1].symmetry.prefix1,
                        prefix2: obj[_i1].symmetry.prefix2,
                        origin: true,
                        // whether it's the start of the symmetry branch or not.
                        // (used to figure out whether the parent is prefixed.)
                    };
                    let desc = AAX.getdesc(body, _i1);
                    for(i2 = 0; i2 < desc.length; i2++) {
                        let _i2 = desc[i2];
                        obj[_i2].symmetry = null;
                        // redundancy could get really stupid
                        symmetry[_i2] = {
                            prefix1: symmetry[_i1].prefix1,
                            prefix2: symmetry[_i1].prefix2,
                            origin: false,
                        };
                    }
                }
            }
            for(i1 in symmetry) {
                if(symmetry.hasOwnProperty(i1)) {
                    let name1 = symmetry[i1].prefix1 + i1;
                    let name2 = symmetry[i1].prefix2 + i1;
                    body[name1] = body[i1];
                    delete body[i1];
                    body[name2] = structuredClone(body[name1]);
                    // biifurcate
                    if(!symmetry[i1].origin) {
                    // this is the child of a symmetry part, so the parent names
                    // should be adjusted to their symmetry names
                        let temp = symmetry[i1].prefix1 + body[name1].parent;
                        if(body.hasOwnProperty(temp)) {
                            body[name1].parent = temp;
                        }
                        else {
                            console.log("this shouldn't happen");
                        }
                        temp = symmetry[i1].prefix2 + body[name2].parent;
                        if(body.hasOwnProperty(temp)) {
                            body[name2].parent = temp;
                        }
                        else {
                            console.log("this shouldn't happen");
                        }
                    };
                    if(body[name1].silhouette[0] && !body[name1].silhouette[1]) {
                    // if they're not in group 0 (probably don't want them
                    // differentiated) and they don't have a subgroup already,
                    // (the user probably already did something with that,
                    // which shouldn't be disturbed) put them in different
                    // silhouette subgroups.
                        let temp = symmetry[i1].prefix1;
                        for(i2 = 0; i2 < temp.length; i2++) {
                            body[name1].silhouette[1] += temp[i2].toLowerCase() === temp[i2].toUpperCase() ? "" : temp[i2];
                        }
                        temp = symmetry[i1].prefix2;
                        for(i2 = 0; i2 < temp.length; i2++) {
                            body[name2].silhouette[1] += temp[i2].toLowerCase() === temp[i2].toUpperCase() ? "" : temp[i2];
                        }
                        // have it match the prefixes, with all non-letters
                        // removed for aesthetics
					};
                    body[name2].mirror = true;
                    // makes sure the part's orient starts as a Quat.mirror.x().
                    AAX.mirror(body, name2, "x");
                    // coordinates, image, perspective
                }
            }
            //
            for(i1 in body) {
                if(body.hasOwnProperty(i1)) {
                    for(i2 in AAX.part_properties) {
                        if(
                            AAX.part_properties.hasOwnProperty(i2)
                            &&
                            !i2.includes("_")
                            &&
                            !(i2 in body[i1])
                            &&
                            AAX.part_properties[i2].type !== "pose_exclusive"
                            &&
                            AAX.part_properties[i2].type !== "pose_getset"
                        ) {
                        // doublecheck that each part is complete
                            console.log("this shouldn't happen");
                            console.log(i1);
                            console.log(i2);
                        }
                    }
                }
            }
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
 thumb_1:		-5, -3, 1
  thumb_2:		-10, -8, 0
   thumb_3:		-2, -6, 0
    thumb_4:	0, -6, 0
 index_1:		-9, -24, -1
  index_2:		0, -12, 0
   index_3:		0, -6, 0
    index_4:	0, -4, 0
 middle_1:		-1, -25, -3
  middle_2:		0, -14, 0
   middle_3:	0, -6, 0
    middle_4:	0, -4, 0
 ring_1:		6, -23, -1
  ring_2:		0, -11, 0
   ring_3:		0, -6, 0
    ring_4:		0, -4, 0
 pinkie_1:		13, -19, 1
  pinkie_2:		0, -6, 0
   pinkie_3:	0, -5, 0
    pinkie_4:	0, -5, 0
// the spacing between knuckles/fingers is about 8
// the gap when the fingers point straight up is less than 1/4 of that, but making it 1 makes poses more clear
// so the finger width is 3
###
[ wrist ]
0, 0, 0, 18, 10, 10
9, -1, 0, 6
[ thumb_1 ]
0, 0, 0, 8
[ thumb_2 ]
0, 0, 0, 8
[ thumb_3 ]
0, 0, 0, 8
[ thumb_4 ]
0, 0, 0, 6
[ index_1 ]
0, 0, 0, 8
[ index_2 ]
0, 0, 0, 8
[ index_3 ]
0, 0, 0, 6
[ index_4 ]
0, 0, 0, 6
[ middle_1 ]
0, 0, 0, 8
[ middle_2 ]
0, 0, 0, 8
[ middle_3 ]
0, 0, 0, 6
[ middle_4 ]
0, 0, 0, 6
[ ring_1 ]
0, 0, 0, 8
[ ring_2 ]
0, 0, 0, 8
[ ring_3 ]
0, 0, 0, 6
[ ring_4 ]
0, 0, 0, 6
[ pinkie_1 ]
0, 0, 0, 8
[ pinkie_2 ]
0, 0, 0, 8
[ pinkie_3 ]
0, 0, 0, 6
[ pinkie_4 ]
0, 0, 0, 6
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
`pelvis: 0, -53, 0
 midsection: 0, -12, 8
 torso: 0, -28, 2
  neckbase: 0, -9, -5
   headbase: 0, -15, 2
    head: 0, -12, 3
  manubrium: 0, 0, 9
   shoulder: -23, 6, -13
    elbow: -1.5, 19.5, -1.5
     wrist: 0.5, 18.5, 0.5
      hand: 1, 3, 1
 hip: -11, 5, 0
  knee: -0.5, 21.5, 0.5
   ankle: 0.5, 20.5, -0.5
    toe: -1, 1, 12
###
[ pelvis ]
// structured sort of like the midsection
-12, -12, 2
x
-9, -3, 11
x
-6, 6, 11
x
-6, 12, -2
x
-9, -6, -11
x
// two rings of points
-18, 0, 0
x
// the tip
[ midsection ]
0, -12, 0
y
-12, -6, 6
z
y
yz
x
xz
xy
xyz
[ torso ]
-9, -14, 3
x
-18, -5, -12
x
yz
xyz
-9, 20, -6
x
[ head ]
[ shoulder ]
0, 0, 0, 15, 15, 15
[ elbow ]
0, 0, 0, 14, 14, 14
[ wrist ]
0, 0, 0, 12, 12, 12
[ hand ]
0, 0, 0, 15, 18, 15
[ hip ]
0, 0, 0, 15, 15, 15
[ knee ]
0, 0, 0, 14, 14, 14
[ ankle ]
0, 0, 0, 12, 12, 12
[ toe ]
0, 0, 0, 15, 9, 9
###
midsection:
	color1*(3)
torso:
	color1(2, 1)
	generation(1, 2)
neckbase:
	generation(0)
headbase:
	capsule(16)
head:
	generation(0)
	silhouette(0b)
manubrium:
	generation(0)
shoulder:
	symmetry()
	color1(3, 4)
	silhouette(1)
	generation(0)
hand:
	generation(0)
hip:
	symmetry()
	generation(0)
	silhouette(2)
knee:
	generation(2)`,
			standard:
`pelvis: 0, -38, 0
 midsection: 0, -3, 3
 torso: 0, -10, 0.5
  neckbase: 0, -9, -0.5
   headbase: 0, -6, 0
    head: 0, -12, 0
  manubrium: 0, -5, 4.5
   shoulder: -9, 5, -5
    elbow: -3, 12, -2
     wrist: -2.5, 11.5, -1.5
      hand: 0, 3.5, 0.5
 hip: -5, 3, 2
  knee: -0.5, 16.5, -1.5
   ankle: -0.5, 15.5, -0.5
    toe: -0.5, 1.5, 6.5
###
[ pelvis ]
-3, 2, 4
x
-5, -2, 4
x
// front
0, 4, -2
-3, -4, -4
x
-6, 1, -2
x
// back
[ midsection ]
0, -6, 0
y
// tips
0, -3, -3
y
-3, -3, 3
x
y
xy
-6, -3, 0
x
y
xy
// vertical pentagonal prism
[ torso ]
0, -2, 6
// front point
-3, -8, 3
x
-9, -2, 1
x
// front
-6, 8, -3
x
// bottom
-3, -5, -6
x
-9, 2, -6
x
0, 2, -6
// back
[ neckbase ]
0, 0, 0
[ headbase ]
0, 0, 0
[ head ]
0, -8, 8
z
//
0, -12, 0
-8, -11, 0
x
-12, -3, 5
x
z
xz
-8, -2, 12
x
z
xz
// top-front and top-back heptagons
0, 11, 12 // jaw
//
-12, 5, 5
x
-8, 12, 2 // jaw
x // jaw
0, 17, 8 // jaw (bottom)
// bottom-front heptagon
0, 14, -5
//
-12, 5, -2 // jaw fulcrum
x // jaw fulcrum
// bottom-back heptagon
//|
//0, 0, 0, 10
//-8, -14, 8
//|
//0, 0, 0, 10
//8, -14, 8
[ manubrium ]
0, 0, 0
[ shoulder ]
0, 0, 0, 6
[ elbow ]
0, 0, 0, 6
[ wrist ]
||
----------------
----------------
----------------
----------------
----------------
-------%%-------
------%%%%------
-----%%%%%%-----
-----%%%%%%-----
-----%%%%%%-----
-----%%%%%%-----
-----%%%%%%-----
-----%%%%%%-----
-----%%%%%%-----
------%%%%------
-------%%-------
|
----------------
----------------
----------------
----------------
----------------
------%%%-------
-----%%%%%------
----%%%%%%%-----
---%%%%%%%%-----
---%%%%%%%%-----
---%%%%%%%%-----
---%%%%%%%%-----
---%%%%%%%%-----
---%%%%%%%%-----
----%%%%%%------
-----%%%%-------
[ hand ]
0, 0, 0
[ hip ]
0, 0, 0, 9
[ knee ]
0, 0, 0, 6
[ ankle ]
0, 0, 0, 6
[ toe ]
0, 0, 0, 5, 2, 2
###
midsection:
	color1*(3)
torso:
	color1(2, 1)
	generation(1, 2)
neckbase:
	generation(0)
headbase:
	capsule(8)
head:
	capsule()
	silhouette(0b)
manubrium:
	generation(0)
shoulder:
	symmetry()
	color1(3, 4)
	silhouette(1)
    generation(0)
hand:
	generation(0)
hip:
	symmetry()
	color1(1, 2)
knee:
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
            this._orient = body[name].mirror ? Quat.mirror.x() : Quat.new();
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
                if(obj.hasOwnProperty(i1) && i1 !== "tool" && i1 !== "body" && i1 !== "pose" && i1 !== "name") {
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
                this.orient = Quat.normalized( Quat.slerp(this.orient, orient, num) );
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
            if(
                property === "shape"
                ||
                property === "orient" || property === "stretch" || property === "widen"
            ) {
            // cache.oriented is obsolete
                this.clearcache("orientedshape");
            }
            else if(property === "x" || property === "y" || property === "z") {
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
        get orientedshape() {
        // returns the shape.points, after orienting the points/groups/etc
        // according to the relevant parts' stretch/widen/orient.
            let i1 = 0;
            let i2 = 0;
            let loop = new Loop("AAX.Part.orientedshape");
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
                _point = Basis.apply(basis, _point).concat(point.slice(3));
                // orient coordinates
                if(_point.length >= 5) {
                // orient orient, for any point that isn't a perfect sphere.
                    _point[5] ??= _point[4];
                    _point[6] ??= Quat.new();
                    _point[6] = Quat.local_multiply(quat, _point[6]);
                    // rotate the quaternion by the part's quaternion
                    if(line && stretch < 0) {
                        _point[6].flip = !_point[6].flip;
                    };
                    if(widen < 0) {
                        _point[6].flip = !_point[6].flip;
                    };
                    // inverting .flip will invert the basis it creates, so you
                    // should do that if stretch or widen is negative.
                    // - the same is true of the part quaternion's flip, but
                    //   local_multiply already applies that.
                }
                return _point;
            };
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
            //let points = rotate(orientedshape, "xz", view*Math.PI/2);
            this.cache.oriented ??= this.orientedshape;
            let points = structuredClone(this.cache.oriented);
            for(i1 = 0; i1 < points.length; i1++) {
            // apply view/camera rotation
                //let viewer = this.tool.drawsettings.viewer;
                //let sizemod = AAX.camerarotations(this.abscoor, view, xz, yz)[2];
                //sizemod = viewer.z_size(viewer.central_z + sizemod);
                //
                points[i1] = rotate(points[i1], "xz", xz);
                points[i1] = rotate(points[i1], "yz", yz);
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
            const abscoor = rotate(this.abscoor, "xz", view*Math.PI/2);
            // rotated absolute coordinates
            let temp = this["perspective_coor_" + view];
            const _abscoor = [
                abscoor[0] + temp[0],
                abscoor[1] + temp[1],
                abscoor[2] + (perspectived ? drawsettings.viewer.central_z : 0)
            ];
            // version with the same floats as abscoor + perspective_coor
            let data = Raster.from3d(points, drawsettings.fineness || 8, _abscoor, perspectived ? drawsettings.viewer : null, "aa");
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
    posetoshape: function(pose) {
    // converts a pose to a shape.
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let partshapes = {};
        // the parts
        let all_abs = AAX.all_abs(pose);
        for(i1 in pose) {
            partshapes[i1] = [];
            let ref = pose[i1].orientedshape;
            for(i2 = 0; i2 < ref.length; i2++) {
                for(i3 = 0; i3 < ref[i2].length; i3++) {
                    let point = structuredClone(ref[i2][i3]);
                    point[0] += all_abs[i1][0];
                    point[1] += all_abs[i1][1];
                    point[2] += all_abs[i1][2];
                    partshapes[i1].push(point);
                    // using Points.add would screw up things past the first
                    // three items.
                    //partshapes[i1].push(Points.add(structuredClone(ref[i2][i3]), all_abs[i1]));
                }
            }
            // combine all groups, and add abscoor
            if(!partshapes[i1].length) {
            // this would add one point at the center of shapeless parts, but...
            // nah. it looks better and clearer without that. it's more
            // intuitive for those parts to be omitted entirely.
                //partshapes[i1].push(structuredClone(all_abs[i1]));
            };
        }
        let groups = [];
        for(i1 in pose) {
            if(pose.hasOwnProperty(i1) && !pose[i1].hide) {
            // now, combine those shapes according to how the parts' connection
            // properties work. (skip hidden parts.)
                let conn = pose[i1].connection;
                if(conn.type === "generation") {
                    groups.push([]);
                    let ref = groups[groups.length - 1];
                    let list = AAX.getanc(pose, i1);
                    list = [i1].concat( list.slice(list.length - conn.value[0]) ).concat( AAX.getdesc(pose, i1, conn.value[1]) );
                    for(i2 = 0; i2 < list.length; i2++) {
                    // combine the partshapes of itself and all applicable
                    // ancestors and descendants.
                        let _i2 = list[i2];
                        let shape = partshapes[_i2];
                        for(i3 = 0; i3 < shape.length; i3++) {
                            ref.push(structuredClone(shape[i3]));
                        }
                    }
                }
                else if(conn.type === "capsule") {
                // capsule makes the part's silhouette concave.
                    let ref = pose[i1].orientedshape;
                    for(i2 = 0; i2 < ref.length; i2++) {
                        groups.push([]);
                        for(i3 = 0; i3 < ref[i2].length; i3++) {
                            let point = structuredClone(ref[i2][i3]);
                            point[0] += all_abs[i1][0];
                            point[1] += all_abs[i1][1];
                            point[2] += all_abs[i1][2];
                            groups[groups.length - 1].push(point);
                        }
                    }
                    let parent = pose[i1].parent;
                    if(conn.value && parent !== "standpoint") {
                        let start = pose[i1].abscoor;
                        let end = pose[pose[i1].parent].abscoor;
                        start.push(conn.value);
                        end.push(conn.value);
                        groups.push([start, end]);
                    };
                };
            }
        }
        return {
            points: groups,
        };
    },
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
    bodychange: function(tool, body, poseobj, old_body_rel, old_rel, old_odd) {
    // makes adjustments for a change in the Body a poseobj is based on.
    // - there's more to it than this, but what this function does is emulate
    //   the old pose's difference between its coordinates and its default
    //   pose's coordinates.
    // - body should be the new body.
    // - old_body_rel: an AAX.all_rel object made from the old body.
    // - old_rel: an AAX.all_rel object made from the old pose.
    // - old_odd: this is kind of weird. sometimes, what's most intuitive is the
    //   most confusing to actually think about.
    //   - it isn't just oddness booleans.
    //   - it's booleans for whether, in the old body and old pose... the
    //     the oddness for this part/axis was different from its oddness in the
    //     default pose.
    //   - since pose tools and all that try to keep it the same, that's what
    //     you need to preserve.
        let i1 = 0;
        let i2 = 0;
        let _poseobj = structuredClone(poseobj)
        let order = AAX.getdesc(body);
        for(i1 = 0; i1 < order.length; i1++) {
            let _i1 = order[i1];
            let part = _poseobj[_i1];
            part.cache = structuredClone(AAX.cache_init);
            // reset the cache entirely, since it doesn't have the same
            // shapes or anything
            if(old_body_rel.hasOwnProperty(_i1) && old_rel.hasOwnProperty(_i1) && body[_i1].parent !== "standpoint") {
                // apply changes to the coordinates. try to
                // emulate the same change between the old
                // default coordinates and the old pose's
                // coordinates.
                // - the standpoint child's coordinates represent
                //   the coordinates of the body in general, so
                //   don't change it.
                let change = Points.change(old_body_rel[_i1], old_rel[_i1]);
                // multiplier and quaternion representing how to
                // get from the old default pose's coordinates
                // to the posed coordinates
                let newcoor = Points.applychange(AAX.relcoor(body[_i1]), change.multiplier, change.quat);
                // old body + change = old pose
                // new body + change = new pose
                if(old_odd.hasOwnProperty(_i1)) {
                // but it should also make adjustments for oddness, so there
                // aren't unexpected changes.
                // - if the pose's oddness matches the old body's oddness, it
                //   should still match.
                // - if it didn't, it shouldn't.
                    let floats = [];
                    let parent = [0, 0, 0];
                    let anc = AAX.getanc(body, _i1);
                    for(i2 = 0; i2 < anc.length; i2++) {
                    // abscoor doesn't work on poseobjs.
                        let ref = _poseobj[ anc[i2] ];
                        parent[0] += ref.x;
                        parent[1] += ref.y;
                        parent[2] += ref.z;
                    }
                    newcoor = Points.add(newcoor, parent);
                    // it's absolute oddness that matters, so add this at the
                    // beginning and subtract it at the end.
                    let temp = AAX.abscoor(body, _i1);
                    for(i2 = 0; i2 < 3; i2++) {
                        let axis = "xyz"[i2];
                        let odd = !!(temp[i2]%1);
                        // copy the current default pose's oddness
                        if(old_odd[_i1][i2]) {
                            odd = !odd;
                        };
                        // if the old pose has different oddness from the old
                        // default pose, invert it
                        floats[i2] = Number(odd)/2;
                    }
                    //newcoor = AAX.fixfloats(newcoor, floats, null, false, "hypot");
                    newcoor = AAX.fixfloats(newcoor, floats);
                    // now bring it to the nearest coordinates that have those
                    // floats.
                    newcoor = Points.subtract(newcoor, parent);
                    // make it relative again
                }
                else {
                    newcoor = Points.divide(Points.trunc(Points.multiply(newcoor, 2)), 2);
                    // make sure these are .0/.5
                }
                part.x = newcoor[0];
                part.y = newcoor[1];
                part.z = newcoor[2];
                // coordinate setter
            }
        }
        return _poseobj;
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
                w: 112,
                h: 144,
            },
            //grid: [4, 4, 0],
            grid: [8, 3, 0],
            // like how it works in face3d, each number is a multiplier of the
            // previous. except for 0, that's special. [4, 4, 0] means "draw
            // lines every 4 pixels, every 4*4 pixels, and at the standpoint."
            standpoint: {
                x: 0,
                y: 56,
            },
            // the coordinates relative to the top left corner of the cell.
            // - these are relative to the center of the cell. .initialize will
            //   correct that.
            vp: {
                x: 0,
                y: 0,
            },
            // vanishing point
            range: 216,
            camera: {
                xz: 0,//2*Math.PI/8,
                yz: 0,
            },
            // xz/yz rotation, the viewer/vanishing point autoperspective will
            // use
            fineness: 4,
            // the level of detail for the spheroids. a quarter-curve has this
            // many sides.
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
            vertices: true,
            // if true, the points that make up a .shape will be drawn by
            // Part.rasterize as 2 pixels. that can get kinda ugly depending on
            // the angle.
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
        }
        get viewer() {
            return new Viewer(
                this.range,
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
            if(this.range !== "none") {
                let viewer = this.viewer;
                let central_z = viewer.central_z;
                _point[2] += central_z;
                // the central_z is the z where sizes will be about the same as they
                // are in 2d, so adding this will make it so things more or less
                // stay put if their z is 0.
                // - and add the standpoint too, since that's how Viewer.convert
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
    // class for storing colors for armature-related drawings
        constructor() {
            let ref = AAX.Color.template;
            for(let i1 in ref) {
                if(ref.hasOwnProperty(i1)) {
                    this[i1] = structuredClone(ref[i1]);
                }
            }
            //Object.assign(this, AAX.Color.template);
            // i would use Object.assign, but it doesn't clone properties. so,
            // .interface and .buttons would end up being references to the
            // template's .interface and .buttons.
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
            //silhouette: ["#2f2f5f", "#9fcfff", "#cf9fff"],
            //silhouette: ["#2f2f5f", "#2f2f5f", "#2f475f", "#472f5f"],
            parts: [
            // defining a part's color1 or color2 makes it use colors from
            // this array.
                "black",
                "#ef007f", // violet red
                "#bfef1f", // lime
                "#007fef", // azure
                "#7f00ef" // purple
            ],
            part_fill: ["#fff", "#ddd", "#bbb"],
            // insides of parts and silhouettes
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
        let temp = AAX.body_read.image_split(AAX.Body.templates.standard.split("###")[1]);
        let array = ["pelvis", "midsection", "torso", "head"];
        for(i1 = 0; i1 < array.length; i1++) {
        // create shape templates from the standard body.
            let _i1 = array[i1];
            AAX.shape_templates[_i1] = temp[_i1].split("\n||\n")[0];
            if(_i1 === "head") {
                AAX.Body.templates.stocky = AAX.Body.templates.stocky.replace("[ " + _i1 + " ]", "[ " + _i1 + " ]\n" + AAX.shape_templates[_i1]);
            }
        }
        array = [];
        for(i1 in AAX.Color.template) {
            if(AAX.Color.template.hasOwnProperty(i1)) {
                if(i1 === "silhouette" || i1 === "interface") {
                // insert gaps
                    array.push(null);
                }
                array.push(i1);
            }
        }
        AAX.ui.color_area.actions.push(["row", array, "r", 1, 4]);
        // finish colors
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
                coor[i1] = AAX.relcoor(body[i1]);
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
        button_text: function(ctx, rect, left, center, right) {
        // draws the text for the button, in the current strokeStyle.
        // - left, center, and right should be strings or string arrays for what
        //   text goes with what alignment.
            let i1 = 0;
            let i2 = 0;
            left = typeof left === "string" ? [left] : Array.isArray(left) ? left : [];
            center = typeof center === "string" ? [center] : Array.isArray(center) ? center : [];
            right = typeof right === "string" ? [right] : Array.isArray(right) ? right : [];
            let rect_center = Rect.center(rect);
            let styletemp = ctx.fillStyle;
            ctx.fillStyle = ctx.strokeStyle;
            let aligntemp = ctx.textAlign;
            for(i1 = 0; i1 < 3; i1++) {
                let text = i1 === 0 ? left : i1 === 1 ? center : i1 === 2 ? right : null;
                ctx.textAlign = i1 === 0 ? "left" : i1 === 1 ? "center" : i1 === 2 ? "right" : "left";
                for(i2 = 0; i2 < text.length; i2++) {
                    let line = text[i2] + "";
                    // stringify
                    let x = rect.x + rect.w*i1/2 + AAX.ui.margin[0]*(1 - i1);
                    if(i1 === 1) {
                    // convoluted bullshit to make sure it isn't blurry when
                    // it's centered
                        let temp = line.length;
                        temp = temp ? !((temp*(AAX.ui.charwidth + 1) - 1)%2) : true;
                        temp /= 2;
                        x = Math.ceil(x - temp) + temp;
                        // round it to a .5 if the number of pixels is even, .0
                        // if it's odd. why isn't it the other way around? who
                        // knows! why is it better centered with ceil than
                        // floor? who knows!
                        // - this is my least favorite kind of math, and as long
                        //   as the problem is solved, i don't care.
                    };
                    ctx.fillText(
                        line,
                        x,
                        Math.floor(rect_center[1] + AAX.ui.margin[1] + AAX.ui.block*(i2 - (text.length - 1)/2))
                    );
                }
            }
            ctx.fillStyle = styletemp;
            ctx.textAlign = aligntemp;
        },
        basis: function(ctx, x, y, r, basis) {
        // draws a basis.
            const styletemp = [ctx.fillStyle, ctx.strokeStyle];
            ctx.strokeStyle = aa.color.buttons[2];
            circledraw(ctx, x, y, r, false);
            let _basis = structuredClone(basis);
            _basis[0][3] = "x";
            _basis[1][3] = "y";
            _basis[2][3] = "z";
            _basis.sort((a, b) => a[2] - b[2]);
            // z sort
            for(let i1 = 0; i1 < 3; i1++) {
                let axis = "xyz".indexOf(_basis[i1][3]);
                let color = ["0", "0", "0"];
                color[axis] = "F";
                ctx.strokeStyle = "#" + color.join("");
                //ctx.strokeStyle = ["red", "green", "blue"][ axis ];
                let back = _basis[i1][2] < 0;
                linespecial(ctx,
                    x + (back ? 2/3 : 0)*r*_basis[i1][0], y + (back ? 2/3 : 0)*r*_basis[i1][1],
                    x + r*_basis[i1][0], y + r*_basis[i1][1],
                    [x, y]
                );
            };
            ctx.fillStyle = styletemp[0];
            ctx.strokeStyle = styletemp[1];
            // draw orient sphere
        },
        rotate_axis_setter_disabled: function(pose, partname, basis, select_axis, suffix) {
        // returns true if the given axis setter button should be disabled.
        // - basis: aa.control.rotate.basis
        // - select_axis: aa.control.rotate.select
        // - NOTE: does not account for whether custom is the current rotate
        //   type. (all of them should be disabled if not.)
            if(suffix === "child") {
                if(!AAX.getchildren(pose, partname).length) {
                    return true;
                };
                let child = AAX.getchildren(pose, partname)[0];
                return !Math.hypot(...pose[child].relcoor);
            }
            else if(suffix === "parent") {
                return !Math.hypot(...pose[partname].relcoor);
            }
            else if(suffix === "cross") {
                return Points.parallel(
                    basis[posmod(select_axis + 1, 3)],
                    basis[posmod(select_axis + 2, 3)]
                );
            };
            return false;
        },
        color_area: {
            prefix: "color",
            direction: "r",
            adjust: 2,
            h: 4,
            actions: [],
            // finished in initialize
            heading: 1,
        },
        draw: {
            drawsettings: function(ctx, rect, drawsettings, suffix, type, _suffix) {
            // - type: how it should be drawn.
            //   - "row": the suffix and values are written on the same line,
            //     the values being separated by commas.
            //   - "double": the suffix and values are on different lines.
            //   - "fancy": the suffix and each value are written on different
            //     lines, with prefixes like "x:" or "y:".
                let i1 = 0;
                let template = AAX.DrawSettings.template;
                if(suffix === "background") {
                    AAX.ui.button_text(ctx, rect, drawsettings[suffix]);
                    return;
                }
                else if(typeof template[suffix] === "boolean" || suffix in AAX.valid) {
                    AAX.ui.button_text(ctx, rect, suffix.replaceAll("_", " "));
                    return;
                };
                type = (
                    ["row", "double", "fancy"].includes(type) ? type :
                    (suffix === "cell" || suffix === "vp" || suffix === "camera") ? "fancy" :
                    "row"
                );
                // if type is omitted, use whatever armature artist uses.
                //
                let prefixes = [];
                let values = [];
                if(Array.isArray(drawsettings[suffix])) {
                // array (of varying length.)
                    if(type === "fancy") {
                        type = "double";
                    }
                    values = drawsettings[suffix];
                }
                else if(typeof drawsettings[suffix] === "object") {
                // object
                    for(i1 in drawsettings[suffix]) {
                        if(drawsettings[suffix].hasOwnProperty(i1)) {
                            prefixes.push(i1 + ":");
                            let temp = drawsettings[suffix][i1];
                            if(suffix === "camera") {
                                temp = Math.round(Angle.convert(temp));
                            };
                            values.push(temp + "");
                        };
                    }
                }
                else {
                // primitive
                    if(type === "fancy") {
                        type = "double";
                    }
                    values.push(drawsettings[suffix]);
                };
                //
                if(suffix === "standpoint") {
                    values[0] -= drawsettings.cell.w/2;
                    values[1] -= drawsettings.cell.h/2;
                }
                else if(suffix === "vp") {
                    values[0] -= drawsettings.standpoint.x;
                    values[1] -= drawsettings.standpoint.y;
                };
                //
                let left = [];
                let center = [];
                let right = [];
                left.push(
                    typeof _suffix === "string" ? _suffix :
                    suffix.replaceAll("_", " ") + (type === "fancy" ? "" : ":")
                );
                //
                if(type === "row" || type === "double") {
                    if(type === "double") {
                        right.push("");
                        left.push("");
                    }
                    right.push(values.join(","));
                }
                else if(type === "fancy") {
                    right.push("");
                    for(i1 = 0; i1 < prefixes.length; i1++) {
                        left.push(prefixes[i1]);
                        right.push(values[i1]);
                    }
                }
                else {
                    console.log("this shouldn't happen");
                }
                // grid
                // standpoint
                // range
                // cell
                // vp
                // camera
                // fineness
                AAX.ui.button_text(ctx, rect, left, center, right);
            },
            color: function(ctx, rect, color, suffix) {
                let num = Number( suffix.slice(suffix.lastIndexOf("_") + 1) );
                if(suffix.includes("_") && !isNaN(num)) {
                // one index of a non-variable length array
                    ctx.fillStyle = color[suffix.split("_").slice(0, -1).join("_")][num];
                    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                }
                else if(Array.isArray(color[suffix])) {
                // variable length array
                    for(let i1 = 0; i1 < color[suffix].length; i1++) {
                        ctx.fillStyle = color[suffix][i1];
                        ctx.fillRect(
                            rect.x,
                            rect.y + rect.h*i1/color[suffix].length,
                            rect.w,
                            rect.h/color[suffix].length
                        );
                    }
                }
                else {
                // single color
                    ctx.fillStyle = color[suffix];
                    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                }
                Rect.fauxstroke(rect, ctx);
            },
        },
        action: {
        // an object of functions used when you click the buttons.
        // - NOTE: they always a boolean for whether to skip refresh. use it.
        // - NOTE: they do NOT edit whatever refresh-skipping variable you have.
        //   do that yourself.
            color: function(color, suffix, rect, click) {
                let prompttext = "";
                let addendum = "\n\nenter a blank string to reset it to the default color.";
                if(["grid", "parts", "silhouette", "part_fill"].includes(suffix)) {
                    prompttext = "enter the colors for the ";
                    prompttext += (
                        suffix === "grid" ? "grids" :
                        suffix === "parts" ? "parts" :
                        suffix === "silhouette" ? "silhouette groups" :
                        suffix === "part_fill" ? "part/silhouette interiors" :
                        ""
                    );
                    prompttext += ", separated by asterisks.";
                    //let temp = String.fromCharCode(10) + String.fromCharCode(9);
                    let temp = " ";
                    temp = " (current:" + temp + color[suffix].join(" *" + temp) + ")";
                    prompttext += "\n\n" + temp;
                    prompttext += addendum;
                    let input = prompt(prompttext);
                    if(typeof input !== "string") {
                        return true;
                    };
                    if(input.trim()) {
                        input = input.split("*");
                        for(let i1 = 0; i1 < input.length; i1++) {
                            input[i1] = input[i1].trim();
                            // this is unnecessary but it bothers me.
                        };
                        color[suffix] = structuredClone(input);
                    }
                    else {
                        color[suffix] = structuredClone(AAX.Color.template[suffix]);
                    };
                }
                else {
                    prompttext = "enter the";
                    let place = color;
                    let _place = AAX.Color.template;
                    let name = suffix;
                    if(["interface", "buttons"].includes(suffix)) {
                        place = place[suffix];
                        _place = _place[suffix];
                        let length = _place.length;
                        let ref = aa.ui.buttons[button];
                        name = Math.floor(length*(click[1] - rect.y)/rect.h);
                        if(name >= 0 && name < length) {
                            prompttext += " " + ["primary", "secondary", "tertiary"][name] + " color for the";
                            if(suffix === "interface") {
                                prompttext += " clickable interface.";
                            }
                            else if(suffix === "buttons") {
                                prompttext += " ui buttons.";
                            };
                        }
                        else {
                            console.log("this shouldn't happen");
                        }
                    }
                    else if(suffix === "side_tint") {
                        prompttext += " color it tints the left/right view backgrounds in.";
                    }
                    else {
                        prompttext += " color it draws the " + name.replaceAll("_", " ");
                        if(suffix === "perspective") {
                            prompttext += " lines";
                        };
                        prompttext += " in.";
                        // fill
                        // nodes
                        // skeleton
                        // perspective
                    };
                    prompttext += " (current: " + place[name] + ")";
                    prompttext += addendum;
                    let input = prompt(prompttext);
                    if(typeof input !== "string") {
                        return true;
                    };
                    place[name] = input.trim() ? input : _place[name];
                }
                return false;
            },
            drawsettings: function(drawsettings, suffix) {
                let i1 = 0;
                if(["cell", "standpoint", "vp", "camera", "grid", "fineness"].includes(suffix)) {
                    let prompttext = null;
                    if(suffix === "cell") {
                        prompttext = `enter the new width and height of the cell, separated by a comma.`;
                    }
                    else if(suffix === "standpoint") {
                        prompttext = `enter two coordinates for the standpoint, separated by a comma, and relative to the center of the cell.`;
                    }
                    else if(suffix === "vp") {
                        prompttext = `enter two coordinates for the vanishing point, separated by a comma, and relative to the standpoint point.`;
                    }
                    else if(suffix === "camera") {
                        prompttext = `enter an xz and yz angle for it to rotate the armature by, separated by a comma, and measured in degrees.`;
                    }
                    else if(suffix === "grid") {
                        prompttext = `enter new grid increments, separated by commas.\n\neach number is a multiplier, so "4, 3, 7" would create lines at every 4 pixels, every 4*3 pixels, and every 4*3*7 pixels. enter 0 anywhere in the list to draw a single set of lines at the standpoint.`;
                    }
                    else if(suffix === "fineness") {
                        prompttext = `enter the level of detail for the spheroids. basically, how many sides a quarter of a circle has. higher numbers are more taxing.`;
                    };
                    if(suffix === "grid") {
                        prompttext += `\n\nremember that you have to edit the grid colors to match, so that there's a color for every increment. otherwise, there will be no visible change.`;
                    }
                    else if(suffix === "fineness") {
                        //prompttext += `\n\nif fineness is 0, it will use an alternate algorithm that's guaranteed to be as high-detail as possible, but can be taxing if the spheroid is too big.`;
                    }
                    else {
                        prompttext += `\n\nyou can leave a value as it was by not typing anything in that place.`;
                        // not happy with that wording.
                    };
                    let input = prompt(prompttext);
                    if(typeof input === "string" && (input.includes(",") || ["grid", "camera", "fineness"].includes(suffix))) {
                        if(suffix === "fineness") {
                            input = Number(input);
                            if(!Number.isInteger(Math.round(input))) {
                            // avoid non-numbers and values like Infinity or NaN
                                return true;
                            }
                            input = Math.round(Math.abs(input));
                            // positive integer divisible by 4
                        }
                        else {
                            input = !input.trim() ? [] : input.split(",");
                            for(i1 = 0; i1 < (suffix === "grid" ? input.length : 2); i1++) {
                                if(suffix !== "grid" && (i1 >= input.length || !input[i1].trim())) {
                                    input[i1] = "no change";
                                    // this way you can set just the yz angle by typing ", 30". stuff like that.
                                }
                                else {
                                    input[i1] = Number(input[i1]);
                                    if(
                                        isNaN(input[i1])
                                        ||
                                        (suffix === "cell" && input[i1] < 2)
                                        ||
                                        (suffix === "grid" && input[i1] < 0)
                                    ) {
                                        return true;
                                    };
                                    if(suffix === "cell") {
                                        input[i1] = Math.floor(input[i1]/2)*2;
                                    }
                                    else if(suffix !== "camera") {
                                        input[i1] = Math.round(input[i1]);
                                    };
                                    // no decimals allowed for most of these
                                }
                            }
                        }
                        //
                        if(["grid", "fineness"].includes(suffix)) {
                            drawsettings[suffix] = structuredClone(input);
                        }
                        else {
                            for(i1 = 0; i1 < 2; i1++) {
                                if(input[i1] !== "no change") {
                                    if(suffix === "cell") {
                                    // adjust coordinates so that standpoint and
                                    // vanishing point stay in the same place.
                                    // - sort of.
                                        let temp = drawsettings.cell["wh"[i1]];
                                        drawsettings.cell["wh"[i1]] = input[i1];
                                        let _temp = drawsettings.standpoint["xy"[i1]];
                                        // standpoint
                                        drawsettings.vp["xy"[i1]] -= _temp;
                                        // the vanishing point should stay in
                                        // about the same place, relative to
                                        // standpoint. subtrct it, and add it
                                        // back after it's modified.
                                        _temp -= temp/2;
                                        // make it relative to the center
                                        _temp *= drawsettings.cell["wh"[i1]]/temp;
                                        // multiply it, to match the cell size
                                        // change (you want it to stay in about
                                        // the same place in the cell, right?)
                                        _temp = drawsettings.cell["wh"[i1]]/2 + Math.trunc(_temp);
                                        // truncate it so it's integers, add it
                                        // to the new cell center
                                        drawsettings.standpoint["xy"[i1]] = _temp;
                                        drawsettings.vp["xy"[i1]] += _temp;
                                    }
                                    else if(suffix === "standpoint") {
                                        let temp = drawsettings.standpoint["xy"[i1]];
                                        drawsettings.standpoint["xy"[i1]] = drawsettings.cell["wh"[i1]]/2 + input[i1];
                                        drawsettings.vp["xy"[i1]] = drawsettings.standpoint["xy"[i1]] + (drawsettings.vp["xy"[i1]] - temp);
                                        // same here.
                                    }
                                    else if(suffix === "vp") {
                                        drawsettings.vp["xy"[i1]] = drawsettings.standpoint["xy"[i1]] + input[i1];
                                    }
                                    else if(suffix === "camera") {
                                        input[i1] = (posmod(input[i1], 360)/360)*2*Math.PI;
                                        // make them radians between 0 and 2 pi
                                        drawsettings.camera["xy"[i1] + "z"] = input[i1];
                                    };
                                }
                            }
                        };
                    }
                }
                else if(suffix === "range") {
                    let input = prompt(`input a new range for the perspective.\n\ndepending on whether something is 0 degrees or 180 degrees from the vanishing point, it'll be between 0 and this many pixels away from it. smaller numbers have more curvature.\n\ntype "none" to have no perspective, just camera xz/yz.`);
                    if(input === "none") {
                        drawsettings.range = input;
                    }
                    else {
                        input = readnumber(input);
                        if(input && input > 0) {
                        // must be positive
                            drawsettings.range = input;
                        };
                    };
                }
                else if(AAX.valid.hasOwnProperty(suffix)) {
                    let index = AAX.valid[suffix].indexOf(drawsettings[suffix]);
                    drawsettings[suffix] = AAX.valid[suffix][(index + 1)%AAX.valid[suffix].length];
                }
                else if(typeof drawsettings[suffix] === "boolean") {
                    drawsettings[suffix] = !drawsettings[suffix];
                };
                return false;
            },
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
        let _point = rotate(
            rotate(
                point,
                "xz",
                xz + (view ?? 0)*Math.PI/2
            ),
            "yz",
            yz
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
    writecoordinates: function(div, text) {
    // used in armature artist and body maker to draw coordinates and/or node
    // names under the canvas.
    // - you can enter arrays or coordinate arrays. it interprets null as "reset
    //   to default", which is generally however many line breaks guarantees
    //   that the stuff after this won't be moving back and forth.
        if(Array.isArray(text)) {
            if(text.length === 3 && typeof text[0] === "number" && typeof text[1] === "number" && typeof text[2] === "number") {
                text = [
                    "x: " + text[0],
                    "y: " + text[1],
                    "z: " + text[2]
                ];
            };
            text = text.join("\n");
        }
        else if(text === null) {
            text = "";
        }
        else if(typeof text === "number") {
            text += "";
        };
        text = text.split("\n");
        if(text.length > 3) {
            text = text.slice(0, 3);
        }
        else if(text.length < 3) {
            text[0] ??= "";
            text[1] ??= "";
            text[2] ??= "";
        };
        for(let i1 = 0; i1 < text.length; i1++) {
            if(!text[i1]) {
                text[i1] = "&#160;";
            };
        }
        text = text.join("<br>");
        div.innerHTML = text;
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
    coorfromcanvas: function(cell, standpoint, x, y, view) {
    // returns an object of two coordinates, based on where you clicked the
    // canvas.
    // - view: if specified, it won't calculate view automatically. (this
    //   way, if you want to get the coordinates of a view 0 click that
    //   drifted off to view 1, it won't screw up.)
        view ??= Math.floor(x/cell.w);
        let temp = AAX.coortocanvas(cell, standpoint, [0, 0, 0], view, true, true);
        let coor = [
            x - temp[0],
            y - temp[1]
        ];
        if([1, 2].includes(view)) {
            coor[0] *= -1;
        };
        return {
            ["xz"[view%2]]: coor[0],
            y: coor[1],
        };
    },
    noderect: function(x, y) {
        return {
            x: Math.floor(x),
            y: Math.floor(y),
            w: 1 + !!(x%1),
            h: 1 + !!(y%1),
        };
    },
    getnode: function(nodes, view, name) {
	// returns the node of the given view and name.
		let ref = nodes[view];
		for(let i1 = 0; i1 < ref.length; i1++) {
			if(ref[i1].name === name) {
				return ref[i1];
			}
		}
		console.log("this shouldn't happen");
		return null;
    },
    noderadius: 1,
    // how close a click has to be to count as clicking a node.
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
                    if(perspectived && ref.range !== "none") {
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
    draw: function(
        ctx, drawsettings, color, perspectived, numofcells,
        pose, nodes, strokecache, rotatecoor, basis
    ) {//yyyaad
    // draws or redraws the main canvas, the one with the multiview on it.
    // - NOTE it also defines the nodes.
    // - rotatecoor: the return of an aa.rotatecoor running, with the
    //   absolute argument as true. used in the rotate pose tool's mid-click
    //   visualization. parts in here will be drawn differently.
    // - basis: used to draw axes.
        //let time = new Date().valueOf();
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let i4 = 0;
        let loop = new Loop("AAX.draw", 10000);
        let view = 0;
        let ds = drawsettings;
        numofcells ??= 4;
        nodes ??= {};
        let coortocanvas = (point, view, nonulls, viewoffset) => AAX.coortocanvas(ds.cell, ds.standpoint, point, view, nonulls, viewoffset);
        let nodeline = function(x1, y1, x2, y2, view, viewoffset) {
            let center = coortocanvas([0, 0, 0], view, true, viewoffset);
            center[0] += .5;
            center[1] += .5;
            linespecial(ctx, x1, y1, x2, y2, center);
        };
        let getnode = (view, name) => AAX.getnode(nodes, view, name);
        let imagedata = [];
        for(i1 = 0; i1 < numofcells; i1++) {
            loop.tick(1);
            imagedata[i1] = ctx.getImageData(i1*ds.cell.w, 0, ds.cell.w, ds.cell.h);
        }
        loop.end();
        let abs = AAX.all_abs(pose);
        // all absolute coordinates
        rotatecoor ??= {};
        basis ??= {};
        // so i don't have to tack on "typeof rotatecoor !== "object" ||"
        // onto everything.
        let fulcrum_name = null;
        // name of the fulcrum. only used in rotatecoor code
        if(!objectisempty(rotatecoor)) {
        // absolutes the coordinates.
        // - thanks to getdesc, it should iterate in an order where the
        //   parent will always have been rotated and absoluted first.
            rotatecoor = structuredClone(rotatecoor);
            // unreference it
            for(part in rotatecoor) {
                loop.tick("part");
                if(rotatecoor.hasOwnProperty(part)) {
                    let parent = pose[part].parent;
                    fulcrum_name ??= parent;
                    // the first properties should be children of the
                    // fulcrum
                    if(parent === fulcrum_name) {
                        parent = pose[parent].abscoor;
                    }
                    else if(rotatecoor.hasOwnProperty(parent)) {
                        parent = rotatecoor[parent];
                    }
                    else {
                        console.log("this shouldn't happen");
                    };
                    rotatecoor[part][0] += parent[0];
                    rotatecoor[part][1] += parent[1];
                    rotatecoor[part][2] += parent[2];
                }
            }
            loop.end();
        };
        ctx.canvas.width = ds.cell.w;
        ctx.canvas.height = ds.cell.h;
        function visible(part, element) {
        // returns a boolean for whether a given element and part should be
        // drawn, based on .hide and rotatecoor. (but NOT the booleans in
        // drawsettings.)
            if(part.hide && ds.total_hide) {
                return false;
            }
            else if(["silhouette", "parts", "perspective"].includes(element)) {
                return !rotatecoor.hasOwnProperty(part.name) && !part.hide;
            }
            else if(element === "skeleton") {
                if(
                    part.parent === "standpoint"
                    ||
                    rotatecoor.hasOwnProperty(part.name)
                    ||
                    (
                        part.pose[part.parent].hide
                        &&
                        ds.total_hide
                    )
                ) {
                    return false;
                };
                let hidden = part.hide;
                if(hidden) {
                // override if it has descendants that aren't hidden
                    let temp = AAX.getdesc(pose, part.name);
                    let i1 = 0;
                    for(i1 = 0; hidden && i1 < temp.length; i1++) {
                        loop.tick(1);
                        if(!pose[ temp[i1] ].hide) {
                            hidden = false;
                        };
                    }
                    loop.end();
                };
                return !hidden;
            }
            else if(element === "nodes") {
                return !rotatecoor.hasOwnProperty(part.name);
            };
        };
        function drawbasis(_basis, coor, view, axis) {
        // _basis should be the basis for a single part, not the whole
        // object.
        // - coor: coordinates of the start of the axes. (don't include view
        //   offset.)
            let i1 = 0;
            let loop = new Loop("AAX.draw drawbasis");
            const styletemp = ctx.strokeStyle;
            ctx.strokeStyle = color.interface[2];
            let __basis = rotate(_basis, "xz", view*Math.PI/2);
            let check = Basis.check(__basis);
            if(check) {
            // log it if the lengths are wrong, or the angles between axes
            // aren't perpendicular
                console.log(check);
                console.log(view);
                console.log(__basis);
            }
            const length = Math.hypot(
                ds.cell.w,
                ds.cell.h
            );
            // longest possible line within the cell
            const length2 = 8;
            // circles are drawn on the lines to measure foreshortening.
            // this is how far along the line they should be.
            let center = coortocanvas([0, 0, 0], view, true);
            __basis[0][3] = "x";
            __basis[1][3] = "y";
            __basis[2][3] = "z";
            __basis.sort((a, b) => a[2] - b[2]);
            // z sort
            for(i1 = 0; i1 < 3 + (false && axis !== null); i1++) {
                loop.tick(1);
                let pole = (
                    i1 === 3
                    ?
                    [
                        roundspecial(axis[0]),
                        roundspecial(axis[1])
                    ]
                    :
                    [
                        roundspecial(__basis[i1][0]),
                        roundspecial(__basis[i1][1])
                    ]
                );
                ctx.strokeStyle = i1 === 3 ? color.interface[2] : ["red", "green", "blue"][ "xyz".indexOf(__basis[i1][3]) ];
                if(pole[0] || pole[1]) {
                // skip it if it's perpendicular to the camera
                    circledraw(
                        ctx,
                        coor[0] + pole[0]*length2,
                        coor[1] + pole[1]*length2,
                        2,
                        false
                    );
                    let hypot = Math.hypot(...pole);
                    pole[0] /= hypot;
                    pole[1] /= hypot;
                    // make hypot 1
                    // - draw the circle first, since that's meant to show
                    //   foreshortening and this will negate that.
                    linespecial(
                        ctx,
                        ...coor,
                        coor[0] + pole[0]*length,
                        coor[1] + pole[1]*length,
                        center
                    );
                }
                else {
                    //console.log(view + " " + "xyz"[i1]);
                    circledraw(ctx, ...coor, 2, false);
                    //console.log(i1 + ": " + pole);
                };
            }
            loop.end();
            ctx.strokeStyle = styletemp;
        };
        function partimage(part, view) {
            if(view === "front" || view === "right") {
                console.log("this should only be run with 0-3 view numbers.");
                return;
            }
            const _view = perspectived ? view : view%2 ? "right" : "front";
            let image = (
                strokecache
                &&
                strokecache.hasOwnProperty(part.name)
                &&
                strokecache[part.name].hasOwnProperty(view)
                ?
                strokecache[part.name][view]
                :
                part[(perspectived ? "perspective_" : "image_") + _view]
            );
            // use the strokecache, if possible.
            if(!perspectived && view >= 2) {
                const w = AAX.l_dim(image.length, part.image_oddness(_view))[0];
                image = Raster.xmirror(image, w);
            }
            return image;
        }
        function onesilhouette(partname, view, multiple) {
        // returns the _2dPoly for the given part, with an
        // offset applied.
        // - multiple: Raster._2dPoly argument. remember, this makes it an
        //   array of shapes instead of just one.
            let loop = new Loop("AAX.draw onesilhouette");
            let part = pose[partname];
            if(view === "front" || view === "right") {
                console.log("this should only be run with 0-3 view numbers.");
                return;
            }
            const _view = perspectived ? view : view%2 ? "right" : "front";
            let shape = partimage(part, view);
            shape = Raster._2dPoly(shape, part.dim(_view, shape.length), multiple);
            if(!shape.length && part.image_source(_view)) {
            // parts with no shape should at least have this.
                shape = [[0, 0]];
                if(multiple) {
                    shape = [shape];
                };
            }
            let node = getnode(view, partname);
            node = [
                node.x - view*ds.cell.w,
                node.y,
            ];
            // reverse view offset
            for(let i1 = 0; i1 < shape.length; i1++) {
            // add offset so it's relative to the corner of the cell instead of
            // relative to the node
                loop.tick(1);
                if(multiple) {
                    for(let i2 = 0; i2 < shape[i1].length; i2++) {
                        loop.tick(2);
                        shape[i1][i2][0] += node[0];
                        shape[i1][i2][1] += node[1];
                    }
                    loop.end();
                }
                else {
                    shape[i1][0] += node[0];
                    shape[i1][1] += node[1];
                }
            }
            loop.end();
            return shape;
        }
        function drawpart(part, view, filltype, x, y) {
        // draws a part onto the canvas coordinates specified.
        // - perspectived: whether to use the perspectived images or not. it
        //   will also add the perspective coordinates to x/y.
        // - filltype:
        //   - falsy: all pixels are drawn
        //   - "fill only": only the fill color is drawn
        //   - "no fill": fill is not drawn
        //   =
        //   - those last two are used if ds.parts === "overlap"
            let i1 = 0;
            let loop = new Loop("AAX.draw drawpart", 100000);
            if(((x ?? null) === null) || ((y ?? null) === null)) {
                let temp = coortocanvas(part.abscoor, view, true);
                x = temp[0];
                y = temp[1];
                if(perspectived) {
                    let coor = part["perspective_coor_" + view];
                    x += coor[0];
                    y += coor[1];
                };
            }
            const _view = perspectived ? view : view%2 ? "right" : "front";
            // number if perspectived, string if not
            let image = partimage(part, view);
            let oddness = part.image_oddness(_view);
            let temp = AAX.l_size(image.length, oddness);
            if(temp === null) {
                console.log({name: part.name, view, image, image_oddness: part.image_oddness(_view)});
            };
            //temp = aa.rect(temp, oddness);
            //const w = temp.w;
            //const h = temp.h;
            //x += temp.x;
            //y += temp.y;
            const w = AAX.onedim(temp, oddness[0]);
            const h = AAX.onedim(temp, oddness[1]);
            x += -(w - 1)/2;
            y += -(h - 1)/2;
            // it should start at the top-left corner, not the center
            if(x%1 || y%1) {
                console.log(part.name + " view " + view + ": the x and y for the image drawing are not integers (" + x + ", " + y + ")");
            };
            //
            image = AAX.sq_raster.fill(image, w);
            //console.log(part.name + " " + view);
            //console.log(image);
            //console.log(image);
            let palette = {
                1: part.color1,
                2: part.color2,
                fill: AAX.getfill(color, part.pose, part.name),
            };
            if(w*h !== image.length) {
                console.log(part.name + " image length does not match the w*h. it's probably that changeoddness or changedimensions isn't being run when it should.");
            };
            for(i1 = 0; i1 < image.length; i1++) {
                loop.tick(1);
                if(
                    image[i1]
                    &&
                    (
                        !filltype
                        ||
                        (filltype === "fill only" && image[i1] === "fill")
                        ||
                        (filltype === "no fill" && image[i1] !== "fill")
                    )
                ) {
                    let _x = i1%w;
                    let _y = Math.floor(i1/w);
                    ctx.fillStyle = palette[image[i1]];
                    ctx.fillRect(x + _x, y + _y, 1, 1);
                };
            }
            loop.end();
        };
        for(view = 0; view < numofcells; view++) {
            loop.tick("view");
            ctx.putImageData(imagedata[view], 0, 0);
            nodes[view] = [];
            let _nodes = nodes[view];
            // used in the clickable interface. objects of x, y, name, and a
            // reference to their parent's node, sorted by z order.
            const stems = {};
            // an object of the node coordinates for the standpoint children
            for(i1 in pose) {
                loop.tick(1);
                if(pose.hasOwnProperty(i1)) {
                    let coor = coortocanvas(pose[i1].abscoor, view, true, true);
                    // no null, view offset
                    if(perspectived) {
                        let _coor = pose[i1]["perspective_coor_" + view];
                        coor[0] += _coor[0];
                        coor[1] += _coor[1];
                    };
                    _nodes[_nodes.length] = {
                        x: coor[0],
                        y: coor[1],
                        z: ds.screen_z(abs[i1], view, perspectived),
                        name: i1,
                    };
                    if(pose[i1].parent === "standpoint") {
                        stems[i1] = structuredClone(coor);
                    };
                }
            }
            loop.end();
            _nodes.sort(function(a, b) {
                let temp = a.z - b.z;
                return (
                    roundspecial(temp)
                    ?
                    temp
                    :
                    (
                        Math.hypot(
                            b.x - stems[ AAX.getstem(pose, b.name) ][0],
                            b.y - stems[ AAX.getstem(pose, b.name) ][1]
                        )
                        -
                        Math.hypot(
                            a.x - stems[ AAX.getstem(pose, a.name) ][0],
                            a.y - stems[ AAX.getstem(pose, a.name) ][1]
                        )
                    )
                );
                // if they're the same, prioritize nodes that are closer to
                // the standpoint child. (this sounds neurotic, but
                // otherwise the layering near the pelvis is l_hip, pelvis,
                // r_hip or something like that.)
            });
            // now it's an array of the order to draw parts in, taking into
            // account view number and xz/yz rotation.
            for(i1 = 0; i1 < _nodes.length; i1++) {
                loop.tick(1);
                let parent = pose[ _nodes[i1].name ].parent;
                if(parent === "standpoint") {
                    _nodes[i1].parent = parent;
                }
                else {
                    for(i2 = 0; i2 < _nodes.length; i2++) {
                        loop.tick(2);
                        if(_nodes[i2].name === parent) {
                            _nodes[i1].parent = _nodes[i2];
                            i2 += _nodes.length;
                        }
                    }
                    loop.end();
                    if(!_nodes[i1].hasOwnProperty("parent")) {
                        console.log("this shouldn't happen");
                    };
                }
            }
            loop.end();
            // create .parent, a reference to the node for the parent.
            if(ds.silhouette !== "off" && strokecache === null) {
            // silhouette can be kind of intensive, so i don't want it to
            // draw per frame.
                let stems = AAX.getchildren(pose);
                let rect = {
                    x: 0, y: 0,
                    w: ds.cell.w, h: ds.cell.h,
                };
                // used to convert coordinates
                let outlines = [];
                // indexed by AAX.getstemnum numbers. each item is an array for
                // every single pixel. if there's an outline on that spot, the
                // value will be that group number. otherwise, it'll be -1.
                const sl_center = coortocanvas([0, 0, 0], view, true);
                let single = {};
                // indexed by part name. objects that describe which pixels each
                // part's silhouette covers. (including area added by
                // connections.)
                for(i1 = 0; i1 < stems.length; i1++) {
                    let _i1 = stems[i1];
                    let parts = [_i1].concat(AAX.getdesc(pose, _i1));
                    let temp = {};
                    for(i2 = 0; i2 < parts.length; i2++) {
                        let _i2 = parts[i2];
                        temp[_i2] = onesilhouette(_i2, view);
                    }
                    let groups = [];
                    // - [silhouette groups]
                    //   - [silhouette subgroups]
                    for(i2 = 0; i2 < parts.length; i2++) {
                        let _i2 = parts[i2];
                        if(visible(pose[_i2], "silhouette")) {
                            let group = ds.silhouette === "overlap" ? pose[_i2].silhouette : [0, ""];
                            for(i3 = groups.length; i3 <= group[0]; i3++) {
                                groups.push({});
                            }
                            groups[ group[0] ][ group[1] ] ??= [];
                            // it'll be an array of _2dPoly.getdatas, for now
                            if(pose[_i2].connection.type === "capsule") {
                                let image = partimage(pose[_i2], view);
                                let dim = pose[_i2].dim(perspectived ? view : view%2 ? "right" : "front", image.length);
                                // gotta convert view to "front"/"right", to
                                // match where the image came from. if
                                // applicable.
                                single[_i2] = {
                                    rect: Raster.dimrect(...dim),
                                    within: Raster.rewrite(image, (value) => !!value),
                                };
                                // _2dPoly.getdata format.
                                let node = getnode(view, _i2);
                                single[_i2].rect.x += node.x - view*ds.cell.w;
                                single[_i2].rect.y += node.y;
                                // make it relative to the top left corner of
                                // the cell
                                if(pose[_i2].connection.value && pose[_i2].parent !== "standpoint") {
                                // add capsule
                                    let r = pose[_i2].connection.value/2;
                                    let start = getnode(view, _i2);
                                    let end = getnode(view, pose[_i2].parent);
                                    start = [
                                        start.x - view*ds.cell.w,
                                        start.y
                                    ];
                                    end = [
                                        end.x - view*ds.cell.w,
                                        end.y
                                    ];
                                    // start and end of the capsule
                                    let temp = Raster.capsule(...start, ...end, r);
                                    single[_i2] = _2dPoly.mergedata([
                                        single[_i2],
                                        {
                                            rect: {x: temp.x, y: temp.y, w: temp.w, h: temp.h},
                                            within: temp.raster,
                                        }
                                    ]);
                                    // merge without convexing
                                }
                                //console.log(_i2);
                                //console.log(Raster.totext(single[_i2].within, single[_i2].rect.w));
                            }
                            else {
                                let shape = [];
                                let list = pose[_i2].silhouettelist;
                                for(i3 = 0; i3 < list.length; i3++) {
                                    shape = shape.concat(temp[ list[i3] ]);
                                }
                                single[_i2] = _2dPoly.getdata(_2dPoly.convexed(shape), true, sl_center);
                            }
                            groups[ group[0] ][ group[1] ].push( structuredClone(single[_i2]) );
                            // add to the data for this combo
                            single[_i2] = {
                                x: single[_i2].rect.x,
                                y: single[_i2].rect.y,
                                w: single[_i2].rect.w,
                                h: single[_i2].rect.h,
                                array: structuredClone(single[_i2].within),
                            };
                            // convert to a better format
                        }
                    }
                    //
                    outlines[i1] = [];
                    for(i2 = 0; i2 < rect.w*rect.h; i2++) {
                        outlines[i1].push(-1);
                    }
                    // - 0 or higher: silhouette group number
                    // - -1: empty
                    // - -2: filled
                    for(i2 = groups.length - 1; i2 >= 0; i2--) {
                    // iterate backwards, so lower group numbers cover up higher
                    // group numbers' outlines.
                        for(i3 in groups[i2]) {
                            if(groups[i2].hasOwnProperty(i3)) {
                            // combine the _2dPoly.getdatas, and add the
                            // outlines to outline.
                                let temp = _2dPoly.mergedata(groups[i2][i3]);
                                let _rect = temp.rect;
                                let array = temp.within;
                                let _array = Raster.outline(array, _rect.w);
                                for(i4 = 0; i4 < array.length; i4++) {
                                    if(array[i4]) {
                                        let index = Rect.getindex(rect, ...Rect.getcoor(_rect, i4));
                                        if(index !== -1) {
                                        // if it's within the cell
                                            if(_array[i4]) {
                                            // designate this pixel as an
                                            // outline of group i2
                                                outlines[i1][index] = i2;
                                            }
                                            else if(outlines[i1][index] === -1) {
                                            // if it's empty and not an outline,
                                            // designate it as fill
                                                outlines[i1][index] = -2;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if(stems.length === 1) {
                // you don't gotta figure out layering if there's only one body.
                    let array = outlines[0];
                    for(i1 = 0; i1 < array.length; i1++) {
                        if(array[i1] !== -1) {
                            let coor = Rect.getcoor(rect, i1);
                            let num = array[i1];
                            ctx.fillStyle = (
                                num === -2 ? color.part_fill[0] :
                                num in color.silhouette ? color.silhouette[num] : "gray"
                            );
                            ctx.fillRect(...coor, 1, 1);
                        };
                    }
                }
                else if(stems.length > 2) {
                    let coverage = [];
                    for(i1 = 0; i1 < rect.w*rect.h; i1++) {
                        coverage.push(-1);
                    }
                    // another per-pixel array. what this one stores is which stem
                    // the frontmost part on this pixel belongs to.
                    for(i1 = 0; i1 < _nodes.length; i1++) {
                        // iterate in z order, and fill coverage.
                        let _i1 = _nodes[i1].name;
                        if(_i1 in single) {
                            let num = AAX.getstemnum(pose, _i1);
                            let _rect = single[_i1];
                            let array = _rect.array;
                            for(i2 = 0; i2 < array.length; i2++) {
                                if(array[i2]) {
                                    // if the part covers this spot:
                                    let index = Rect.getindex(rect, ...Rect.getcoor(_rect, i2));
                                    // Rect.getcoor is the coordinates relative to
                                    // the corner of the cell, Rect.getindex is
                                    // which index of image.array that should be.
                                    // (-1 if it's out of bounds.)
                                    if(index !== -1) {
                                        coverage[index] = num;
                                    };
                                };
                            }
                        }
                    }
                    for(i1 = 0; i1 < coverage.length; i1++) {
                        if(coverage[i1] !== -1) {
                            // draw. finally. christ.
                            let coor = Rect.getcoor(rect, i1);
                            let num = coverage[i1];
                            // stem number
                            let _num = outlines[num][i1];
                            // silhouette group
                            ctx.fillStyle = (
                                _num === -2 ? color.part_fill[num%color.part_fill.length] :
                                _num in color.silhouette ? color.silhouette[_num] : "gray"
                            );
                            ctx.fillRect(...coor, 1, 1);
                        };
                    }
                }
                else {
                // zero part bodies and stemless bodies shouldn't be possible.
                    console.log("this shouldn't happen");
                }
            };
            for(i1 = 0; i1 < _nodes.length; i1++) {
                loop.tick(1);
                if(basis.hasOwnProperty(_nodes[i1].name)) {
                    drawbasis(
                        basis[_nodes[i1].name],
                        [_nodes[i1].x - view*ds.cell.w, _nodes[i1].y],
                        view,
                        Quat.axis(pose[ _nodes[i1].name ].orient)
                    );
                }
            }
            loop.end();
            if(ds.parts === "overlap") {
                for(i1 = 0; i1 < _nodes.length; i1++) {
                    loop.tick(1);
                    let part = pose[ _nodes[i1].name ];
                    if(visible(part, "parts")) {
                        drawpart(part, view, "fill only", _nodes[i1].x - view*ds.cell.w, _nodes[i1].y);
                        // drawpart can fill in the coordinates on its own, but
                        // waste not want not.
                    }
                }
                loop.end();
            };
            if(ds.parts !== "off") {
            // draw parts
                for(i1 = 0; i1 < _nodes.length; i1++) {
                    loop.tick(1);
                    let part = pose[ _nodes[i1].name ];
                    if(visible(part, "parts")) {
                        drawpart(part, view, (ds.parts === "overlap" ? "no fill" : null), _nodes[i1].x - view*ds.cell.w, _nodes[i1].y);
                    }
                }
                loop.end();
            };
            if(ds.skeleton) {
            // draw skeleton
                ctx.strokeStyle = color.skeleton;
                for(i1 = 0; i1 < _nodes.length; i1++) {
                    loop.tick(1);
                    let part = pose[ _nodes[i1].name ];
                    if(visible(part, "skeleton")) {
                        nodeline(
                            _nodes[i1].parent.x - view*ds.cell.w,
                            _nodes[i1].parent.y,
                            _nodes[i1].x - view*ds.cell.w,
                            _nodes[i1].y,
                            view,
                        );
                    }
                }
                loop.end();
            };
            if(ds.perspective) {
            // draw perspective
                ctx.strokeStyle = color.perspective;
                for(i1 = 0; i1 < _nodes.length; i1++) {
                    loop.tick(1);
                    let part = pose[ _nodes[i1].name ];
                    if(visible(part, "perspective")) {
                        const rotated_coor = coortocanvas(AAX.camerarotations(part.abscoor, null, ds.xz, ds.yz, "same floats"), view, true, false);
                        // rotated unperspectived coordinates. (it should
                        // start here so that the lines point to the
                        // vanishing point.)
                        //const rect = AAX.noderect(...rotated_coor);
                        //ctx.strokeRect(rect.x - .5, rect.y - .5, rect.w + 1, rect.h + 1);
                        // testing code. the rotated coordinates don't
                        // actually display anywhere.
                        let perspectived_coor = coortocanvas(part.abscoor, view, true, false);
                        let temp = part["perspective_coor_" + view];
                        perspectived_coor[0] += temp[0];
                        perspectived_coor[1] += temp[1];
                        nodeline(
                            ...rotated_coor,
                            ...perspectived_coor,
                            view
                        );
                    }
                }
                loop.end();
            };
            if(ds.nodes) {
            // draw nodes
                ctx.fillStyle = color.nodes;
                for(i1 = 0; i1 < _nodes.length; i1++) {
                    loop.tick(1);
                    let part = pose[ _nodes[i1].name ];
                    if(visible(part, "nodes")) {
                    // draw nodes even if the part is hidden
                        const rect = AAX.noderect(_nodes[i1].x, _nodes[i1].y);
                        //ctx.fillRect(_nodes[i1].x - view*ds.cell.w + rect.x, _nodes[i1].y + rect.y, rect.w, rect.h);
                        ctx.fillRect(rect.x - view*ds.cell.w, rect.y, rect.w, rect.h);
                    }
                }
                loop.end();
            };
            if(!objectisempty(rotatecoor)) {
            // the code in here only happens for rotatecoor.
                let fulcrum = null;
                // screen coordinates of the fulcrum's node
                for(i1 = 0; i1 < _nodes.length; i1++) {
                    loop.tick(1);
                    if(_nodes[i1].name === fulcrum_name) {
                        fulcrum = [_nodes[i1].x - view*ds.cell.w, _nodes[i1].y];
                        // negate the view offset (that was
                        // added earlier, for the clickable
                        // interface's sake.)
                    }
                }
                loop.end();
                if(fulcrum === null) {
                    console.log("this shouldn't happen");
                };
                let _rotatecoor = {};
                // object for the coortocanvas-ed coordinates.
                ctx.strokeStyle = color.interface[0];
                for(i1 in rotatecoor) {
                    loop.tick(1);
                    if(rotatecoor.hasOwnProperty(i1)) {
                        _rotatecoor[i1] = coortocanvas(rotatecoor[i1], view, true, false);
                        let parent = pose[i1].parent;
                        if(parent === fulcrum_name) {
                        // probably the fulcrum. that isn't included in the
                        // rotatecoor object because it doesn't move.
                            parent = fulcrum;
                        }
                        else if(rotatecoor.hasOwnProperty(parent)) {
                            if(!_rotatecoor.hasOwnProperty(parent)) {
                            // it should be in getdesc order, so parents should
                            // be put in _rotatecoor before their children.
                                console.log("this shouldn't happen");
                            };
                            parent = _rotatecoor[parent];
                        }
                        else {
                            console.log("this shouldn't happen");
                        };
                        //console.log("===" + i1 + "===");
                        //console.log(parent);
                        //console.log(_rotatecoor[i1]);
                        nodeline(
                            ...parent,
                            ..._rotatecoor[i1],
                            view
                        );
                    }
                }
                loop.end();
                // draw lines
                fulcrum = AAX.noderect(...fulcrum);
                ctx.fillStyle = color.interface[0];
                ctx.fillRect(fulcrum.x - 2, fulcrum.y - 2, fulcrum.w + 4, fulcrum.h + 4);
                for(i1 in _rotatecoor) {
                    loop.tick(1);
                    if(_rotatecoor.hasOwnProperty(i1)) {
                        _rotatecoor[i1] = AAX.noderect(_rotatecoor[i1][0], _rotatecoor[i1][1]);
                        ctx.fillRect(_rotatecoor[i1].x - 1, _rotatecoor[i1].y - 1, _rotatecoor[i1].w + 2, _rotatecoor[i1].h + 2);
                    }
                }
                loop.end();
                // draw node outlines
                ctx.fillStyle = color.interface[1];
                ctx.fillRect(fulcrum.x, fulcrum.y, fulcrum.w, fulcrum.h);
                for(i1 in _rotatecoor) {
                    loop.tick(1);
                    if(_rotatecoor.hasOwnProperty(i1)) {
                        ctx.fillRect(_rotatecoor[i1].x, _rotatecoor[i1].y, _rotatecoor[i1].w, _rotatecoor[i1].h);
                    }
                }
                loop.end();
                // draw node interiors
            }
            //
            imagedata[view] = ctx.getImageData(0, 0, ds.cell.w, ds.cell.h);
        }
        loop.end();
        ctx.canvas.width = numofcells*ds.cell.w;
        ctx.clearRect(0, 0, numofcells*ds.cell.w, ds.cell.h);
        for(view = 0; view < numofcells; view++) {
            loop.tick("view");
            ctx.putImageData(imagedata[view], view*ds.cell.w, 0);
        }
        loop.end();
        //console.log("AAX.draw took " + (new Date().valueOf() - time)/1000 + " seconds.");
    },
    posint: (num) => Math.abs(Math.round(typeof num === "string" ? Number(num) : num)),
    strings: {
    // functions for interpreting strings as values. usually, stuff used in the
    // bodytext interpreter
        coor: function(string, roundfactor) {
        // converts a string of coordinates into an array of numbers.
        // - roundfactor: if it's .5, it'll round to the nearest .5. etc. (if
        //   it's zero or it isn't a number, it won't round it at all.)
            roundfactor = typeof roundfactor === "number" ? roundfactor : 0;
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
            for(let i1 = 0; i1 < 3; i1++) {
                coor[i1] = Number(coor[i1]);
                if(roundfactor) {
                    coor[i1] = Math.round(coor[i1]/roundfactor)*roundfactor;
                };
                if(isNaN(coor[i1])) {
                    return null;
                };
            }
            return coor;
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
        // creates a quaternion from the string.
            let i1 = 0;
            string = string.split(",");
            let invert = [];
            // array of which flip/mirror command, if any, each line had.
            // - -1: none
            // - 0, 1, 2: x/y/z mirror
            // - this is such a stupid way to structure things, but it's the
            //   best way to be sure it always does whatever the user
            //   expected...
            let literal = [];
            // used to tell whether it's the {w, x, y, z} style instead of
            // rotations, and what those values are.
            for(i1 = 0; i1 < string.length; i1++) {
                string[i1] = string[i1].trim();
                if(string[i1].endsWith(" mirror")) {
                    let temp = string[i1].slice(0, -" mirror".length);
                    let axis = temp.length === 1 ? "xyz".indexOf(temp) : -1;
                    invert.push(axis);
                }
                else {
                    if(literal) {
                        if(literal.length < 4 && string[i1].startsWith("wxyz"[literal.length] + ":")) {
                            literal.push(readnumber(string[i1].slice(2)));
                        }
                        else {
                            literal = null;
                        };
                    }
                    invert.push(-1);
                }
            }
            if(literal && literal.length === 4 && !literal.includes(null)) {
            // written as a quaternion
                let quat = {
                    w: literal[0],
                    x: literal[1],
                    y: literal[2],
                    z: literal[3],
                    flip: false,
                };
                let _invert = [false, false, false];
                for(i1 = 0; i1 < invert.length; i1++) {
                    if(invert[i1] !== -1) {
                        _invert[ invert[i1] ] = !_invert[ invert[i1] ];
                    };
                }
                return Quat.mirror.multi(quat, ..._invert);
            };
            let tilt = null;
            for(let i1 = 0; i1 < string.length; i1++) {
                string[i1] = string[i1].trim();
                if(invert[i1] !== -1) {
                    tilt ??= Quat.new();
                    tilt = Quat.mirror["xyz"[ invert[i1] ]](tilt);
                }
                else {
                    let rotation = string[i1].split(":");
                    if(rotation.length >= 2) {
                        let axis = rotation[0].trim();
                        let angle = posmod(readnumber(rotation[1]) ?? 0, 1);
                        // can use fractions
                        if(["yz", "xz", "xy"].includes(axis) && angle) {
                            tilt ??= Quat.new();
                            tilt = Quat.rotate(tilt, axis, 2*Math.PI*angle);
                        };
                    }
                }
            }
            return tilt;
        },
        shape: function(string) {
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            let loop = new Loop("AAX.strings.shape");
            let shape = {
                points: [],
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
                string[i1] = string[i1].trim().split("\n");
                for(i2 = 0; i2 < string[i1].length; i2++) {
                    // line breaks split it up into points
                    loop.tick(2);
                    string[i1][i2] = string[i1][i2].trim();
                    if(string[i1][i2]) {
                    // skip blank lines. those could be interpreted as "copy
                    // point 0". benign, but inefficient
                        let point = string[i1][i2];
                        let temp = shape.points[i1].length;
                        // store the previous length so it can tell if a point
                        // was added this loop
                        if(point.includes(",")) {
                            point = point.split(",");
                            let coor = AAX.strings.coor(point.slice(0, 3));
                            let dim = AAX.strings.dimension(point.slice(3, 6));
                            // makes sure they're valid,
                            // returns null if they're not
                            let tilt = AAX.strings.tilt(point.slice(6).join(","));
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
                            let invert = [false, false, false];
                            for(i3 = 0; i3 < 3; i3++) {
                                loop.tick(3);
                                if(point.startsWith("xyz"[i3])) {
                                    invert[i3] = !invert[i3];
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
                                let point = shape.points[i1][ temp ];
                                for(i3 = 0; i3 < 3; i3++) {
                                    if(invert[i3]) {
                                    // position inversion
                                        point[i3] *= -1;
                                    }
                                }
                                if(point.length >= 7) {
                                // quaternion inversion
                                // - technically, if it has more than one
                                //   dimension at all, it should get a
                                //   quaternion, so it can be flipped.
                                // - but these are spheroids. perfectly
                                //   symmetrical shapes. if there's no previous
                                //   rotations giving it asymmetry, there's no
                                //   point inverting that nonexistent asymmetry.
                                    //point[5] ??= point[4];
                                    //point[6] ??= Quat.new();
                                    point[6] = Quat.mirror.multi(point[6], ...invert);
                                };
                            };
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
    shapetostring: function(shape) {
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let text = [];
        for(i1 = 0; i1 < shape.points.length; i1++) {
            let group = shape.points[i1];
            if(i1) {
                text.push("|");
            }
            let invert_base = null;
            // used when making point inversions. the last point that was
            // written as numbers, not inversion letters.
            for(i2 = 0; i2 < group.length; i2++) {
                let point = group[i2];
                let invert = "";
                if(invert_base && compareobject(point.slice(3), invert_base.slice(3))) {
                // check if this point can be made into an inversion of the
                // previous, and find out what axes it has to be inverted with.
                    let nah = false;
                    for(i3 = 0; i3 < 3 && !nah; i3++) {
                        if(point[i3] === invert_base[i3]) {
                            // this needs to go before the negative check, so
                            // that, if the coordinates are zero and therefore
                            // both are true, it'll opt for less letters.
                        }
                        else if(point[i3] === -invert_base[i3]) {
                            invert += "xyz"[i3];
                        }
                        else {
                        // at least one coordinate matches neither invert_base
                        // nor the inversion of invert_base.
                            nah = true;
                        }
                    }
                };
                if(invert) {
                    text.push(invert);
                }
                else {
                    let line = [];
                    for(i3 = 0; i3 < point.length; i3++) {
                        if(i3 < 6) {
                            line.push(point[i3]);
                        }
                        else if(i3 === 6 && Quat.valid(point[i3])) {
                            for(let i4 in point[i3]) {
                                line.push(i4 + ": " + point[i3][i4]);
                            }
                        }
                        else {
                            console.log("this shouldn't happen");
                            console.log("i: " + [i1, i2, i3].join(", "));
                            console.log(structuredClone(point));
                        }
                    }
                    text.push(line.join(", "));
                    invert_base = point;
                }
            }
        }
        return text.join("\n");
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
    getstemnum: (body, part) => AAX.getchildren(body, "standpoint").indexOf(AAX.getstem(body, part)),
    getfill: (color, body, part) => color.part_fill[AAX.getstemnum(body, part)%color.part_fill.length],
    // returns the appropriate part_fill color to use for the given part.
    valid: {
    // stores arrays for which values are accepted, whether to check for
    // validity or iterate through them. mostly for drawsettings.
        posetools: ["move", "deform", "tilt", "rotate", "perspective"],
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
        part_properties: ["", "no_default", "body_exclusive", "pose_exclusive", "pose_getset"],
        // valid part_properties types
        rotate_type: ["true", "local", "custom"],
        rotate_axis_setters: "parent child cross true local written".split(" "),
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
    // obsolete.
    prefix1: "l_",
    prefix2: "r_",
    // used in bodytext's symmetry command. the default prefixes.
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
    shape_radius: function(points) {
    // used in body maker. the radius of the tightest sphere the shape could fit
    // in.
    // - NOTE: does NOT account for spheroid rotation.
    // - returns null if the shape has no points.
        let radius = null;
        for(let i1 = 0; i1 < points.length; i1++) {
            for(let i2 = 0; i2 < points[i1].length; i2++) {
                let point = points[i1][i2];
                if(point.length < 3) {
                    console.log("this shouldn't happen");
                }
                else {
                    let coor = point.slice(0, 3);
                    let hypot = Math.hypot(...coor);
                    if(point.length === 4) {
                        hypot += Math.abs(point[3])/2;
                    }
                    else if(point.length > 4) {
                        let temp = Points.normalized(coor);
                        for(let i3 = 0; i3 < 3; i3++) {
                            temp[i3] *= Math.abs(point[3 + i3] ?? point[3])/2;
                        }
                        hypot += Math.hypot(...temp);
                    }
                    radius = Math.max(radius ?? 0, hypot);
                }
            }
        }
        return radius;
    },
    shape_bounds: function(points) {
    // used in body maker. the edges of the smallest box the shape could fit in.
    // - NOTE: again, it does NOT account for spheroid rotation.
    // - returns null if the shape has no points.
        let bounds = null;
        for(let i1 = 0; i1 < points.length; i1++) {
            for(let i2 = 0; i2 < points[i1].length; i2++) {
                let point = points[i1][i2];
                if(point.length < 3) {
                    console.log("this shouldn't happen");
                }
                else {
                    let coor = point.slice(0, 3);
                    bounds ??= {
                        l: coor[0], r: coor[0],
                        u: coor[1], d: coor[1],
                        b: coor[2], f: coor[2],
                    };
                    for(let i3 = 0; i3 < 3; i3++) {
                        let dim = Math.abs(point[3 + i3] ?? (point[3] ?? 0))/2;
                        bounds["lub"[i3]] = Math.min(bounds["lub"[i3]], coor[i3] - dim);
                        bounds["rdf"[i3]] = Math.max(bounds["rdf"[i3]], coor[i3] + dim);
                    }
                }
            }
        }
        return bounds;
    },
    save: function(filename, text) {
    // saves a string as a txt file.
        let blob = new Blob([ text ], {type: "text/plain"});
        let url = URL.createObjectURL(blob);
        let downloader = document.createElement("a");
        downloader.href = url;
        //browser.downloads.download({url: url, filename: filename});
        //URL.revokeObjectURL(url);
        // - this is what mdn says to use, but it doesn't work on android.
        //   so why do they recommend it.
        downloader.download = filename;
        downloader.click();
    },
    load: function(code) {
    // what happens when the load button is clicked. it asks for a file,
    // then runs your function on it.
        let input = document.createElement("input");
        input.type = "file";
        input.accept = ".txt";
        input.oninput = function() {
            code(input.files[0]);
        };
        input.click();
    },
    dragndrop: function(canvas, code) {
    // adds drag n drop file loading to the given canvas.
    // - code should be a (file) function.
        canvas.ondragover = function(e) {
            e.preventDefault();
        };
        canvas.ondrop = function(e) {
            let files = e.dataTransfer.items;
            if(files.length >= 1 && files[0].kind === "file") {
                code(files[0].getAsFile());
            };
            e.preventDefault();
        };
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

function circcirctangent(x1, y1, r1, x2, y2, r2) {
// NOTE: this returns ANGLES, not points. it also returns null if one circle is
// entirely inside the other.
// - an array of two.
// - get the angle from circle 1 to circle 2
// - circle 1 tangents at that plus [0] of the return, and that minus [0] of the
//   return.
// - circle 2, at that +- [1].
	if(r1 === r2) {
		return [Math.PI/2, Math.PI/2];
	};
	let invert = r1 > r2;
	// the logic will assume r1 is smaller.
	if(invert) {
		let temp = r1;
		r1 = r2;
		r2 = temp;
	};
	let values = [null, null];
	let dist = [x2 - x1, y2 - y1];
	let angle = (dist[0] || dist[1]) ? get2dangle(...dist) : null;
	dist = Math.hypot(...dist);
    if(dist + r1 <= r2) {
    // smaller one is entirely inside the bigger one
        return null;
    }
	else if(!r1) {
	// point/circle tangent
		values = [
			0,
			Math.PI - Math.asin(r2/dist)
		];
		// the point, circle, and tangent form a right triangle, with the
        // tangent being the right angle
		// - two triangles if you include the other tangent. but who cares
		// - the angle we want is the one at the point, so that means...
		// - opp = r2
		// - hyp = dist
		// - sin(angle) = opp/hyp
		// - angle = asin(opp/hyp)
		// - subtract it from pi, since this is supposed to be the angle
        //   difference between the tangent angle and the 1 to 2 angle
	}
	else {
		let temp = (r2 - r1)/dist;
		// rate of change
		temp = r1/temp;
		temp = [
			x1 - Math.cos(angle)*temp,
			y1 - Math.sin(angle)*temp,
			0
		];
		values[0] = circcirctangent(...temp, x1, x1, r1)[1];
		values[1] = circcirctangent(...temp, x2, x2, r2)[1];
	};
	return (
		invert
		?
		// don't just switch the order. subtract them from pi, since the 1 to 2
        // angle is the opposite of what i thought it was.
		[
			Math.PI - values[1],
			Math.PI - values[0]
		]
		:
		values
	);
}

class Round3D {
// a class for infinitely round 3d shapes.
// - x, y, z
// - orient: the basis for this is often used for texture directions and the
//   like
// - texture: can be a color, or an ImageData of any positive dimensions
// - repeat_x, repeat_y: the texture is multiplied by this much, ex: 2 and 3
//   would make it a 2 x 3 grid.
// - doublesided
	constructor() {
		this.x = 0;
		this.y = 0;
		this.z = 0;
		this.orient = Quat.new();
		this.settexturecolor(191, 191, 191);
		this.repeat_x = 1;
		this.repeat_y = 1;
		this.doublesided = false;
	}
    settexturecolor(r, g, b, a) {
    // makes the texture a single pixel of this color.
        let array = new Uint8ClampedArray(4);
        array[0] = r ?? 255;
        array[1] = g ?? 255;
        array[2] = b ?? 255;
        array[3] = a ?? 255;
        this.texture = new ImageData(array, 1);
    }
	get basis() {
	// vectors for the x, y, and z axis of the shape, considering its
	// orientation.
		return Quat.basis(this.orient);
	}
    translate(point) {
    // translates a point relative to this shape's position/orientation to
    // absolute space.
        return Points.add(this, Quat.apply(this.orient, point));
    }
    revolve(axis, magnitude, center) {
        center ??= [0, 0, 0];
        let quat = Quat.new(axis, magnitude);
        Points.apply(
            Points.add(this, Quat.apply( Points.subtract(this, center) ) ),
        this);
        this.orient = Quat.multiply(this.orient, quat);
    }
	rotate(axis, magnitude) {
		this.orient = Quat.rotate(this.orient, axis, magnitude);
	}
	local_rotate(axis, magnitude) {
		this.orient = Quat.local_rotate(this.orient, axis, magnitude);
	}
    texturecolor(x, y) {
    // x and y should be 0 to 1 numbers. it will return an array of 0-255
    // numbers.
        if(this.repeat_x) {
        // 0 is the only invalid number
            x = posmod(x*Math.abs(this.repeat_x), 1);
            if(this.repeat_x < 0) {
                x = posmod(1 - x, 1);
            };
        };
        if(this.repeat_y) {
            y = posmod(y*Math.abs(this.repeat_y), 1);
            if(this.repeat_y < 0) {
                y = posmod(1 - y, 1);
            };
        };
        x = Math.floor(x*this.texture.width);
        y = Math.floor(y*this.texture.height);
        let num = this.texture.width*y + x;
        return this.texture.data.slice(4*num, 4*(num + 1));
    }
    static ellipse_data(angles, factors) {
    // a function that returns the equation and maximum radius of a stretched
    // ellipse.
    // - use this with ellipse_coverage.
    // - the angles and factors are used in Point2.stretch.
        let i1 = 0;
        let i2 = 0;
        if(!Array.isArray(angles) || !Array.isArray(factors) || angles.length !== factors.length) {
            console.log("invalid input.");
        }
        let xx = 1;
        let xy = 0;
        let yx = 0;
        let yy = 1;
        // calculating whether a pixel is inside will be easier if we have the
        // equation of the circle.
        // - for a normal circle, the equation is x2 + y2 = r2.
        // - x2 = r2 - y2
        // - x can equal sqrt(r2 - y2) or -sqrt(r2 - y2), because squaring either
        //   will give you r2 - y2.
        // - the equation of a stretched ellipse is much more complex, but it can
        //   still be simplified to how much of x2 and how much of y2 you have.
        // - the equation is (xx*x + xy*y)^2 + (yx*x + yy*y)^2 = r2. xx, xy, etc are
        //   constants, and x/y can only be figured out once those four numbers are
        //   figured out.
        // - using imaginary number rotation, (and desmos) you can get this equation
        //   for an ellipse that can be stretched in both directions.
        //   - ((cos*x - sin*y)/factor)^2 + (sin*x + cos*y)^2 = r^2
        // - so for each stretch, that's what we'll do to these.
        // - for now, we're ignoring x, y, and r, since they can be applied at the
        //   end.
        for(i1 = 0; i1 < angles.length; i1++) {
            let cos = Math.cos(angles[i1]);
            let sin = Math.sin(angles[i1]);
            // - xx = cos/factor, xy = -sin/factor, yx = sin, yy = cos.
            // - but the thing is, every stretch is cumulative of the previous one.
            //   that doesn't mean something simple like multiplying.
            // - (xx*x + xy*y) replaces the x of the old x2 + y2 equation. so, we
            //   need to substitute that.
            // - ((cos*x - sin*y)/factor)^2 + (sin*x + cos*y)^2
            // - ((cos*(xx*x + xy*y) - sin*(yx*x + yy*y))/factor)^2 + (sin*(xx*x + xy*y) + cos*(yx*x + yy*y))^2
            // - ((cos*xx*x + cos*xy*y - sin*yx*x - sin*yy*y)/factor)^2 + (sin*xx*x + sin*xy*y + cos*yx*x + cos*yy*y)^2
            // - (( (cos*xx - sin*yx)*x + (cos*xy - sin*yy)*y )/factor)^2 + ( (sin*xx + cos*yx)*x + (sin*xy + cos*yy)*y )^2
            xx = (cos*xx - sin*yx)/factors[i1];
            xy = (cos*xy - sin*yy)/factors[i1];
            yx = sin*xx + cos*yx;
            yy = sin*xy + cos*yy;
        }
        // if (xx*x + xy*y)^2 + (yx*x + yy*y)^2 <= r^2, it's inside.
        let temp = Points.multiply([0, 1, 2, 3], Math.PI/2).concat(angles);
        let r = 1;
        for(i1 = 0; i1 < temp.length; i1++) {
            let angle = temp[i1];
            if(i1 >= 4 && factors[i1 - 4] < 0) {
                angle = posmod(angle + Math.PI, 2*Math.PI);
            };
            let point = [Math.cos(angle), Math.sin(angle)];
            for(i2 = 0; i2 < angles.length; i2++) {
                point = Point2.stretch(point, angles[i2], factors[i2]);
            }
            r = Math.max(r, Math.hypot(...point));
        }
        // i don't know enough to be able to calculate the smallest rectangle the
        // ellipse fits inside. so instead, get the highest radius.
        // - the angle with the highest radius has to be one of the cardinals or one
        //   of the stretch angles. (or their inversion, if the factor was
        //   negative.) get the hypotenuse of that.
        return {xx, xy, yx, yy, r};
    }
    static ellipse_coverage(data, x, y, r) {
    // data: an ellipse_data object.
        let _r = data.r*r;
        let rect = Rect.fromedges(
            Math.floor(x - _r),
            Math.ceil(x + _r),
            Math.floor(y - _r),
            Math.ceil(y + _r)
        );
        let within = [];
        for(let i1 = 0; i1 < rect.w*rect.h; i1++) {
            let point = Raster.indextocoord(i1, rect);
            let _x = point[0] + .5 - x;
            let _y = point[1] + .5 - y;
            within[i1] = (data.xx*_x + data.xy*_y)^2 + (data.yx*_x + data.yy*_y)^2 <= r^2;
        }
        return {rect, within};
    }
    scale(num) {
        if(this instanceof RoundTube) {
            this.startsize *= num;
            for(let i1 = 0; i1 < this.lathe.length; i1++) {
                this.lathe[i1].size *= num;
                this.lathe[i1].h *= num;
            }
        };
        if(this instanceof RoundRect) {
            this.w *= num;
            this.h *= num;
        };
        if(this instanceof RoundDisc) {
            this.xr *= num;
            this.yr *= num;
        };
    }
}
class RoundTube extends Round3D {
// a class for cylinder-like shapes.
// - the catch is that the width can vary. it can be a cone, a saucer, something
//   more complicated...
// - it does NOT have a top or bottom surface.
// - position represents the center of one of the ends.
// - the x axis of the texture represents angle, y is where it is from start to
//   end
// - the x and y axes of the basis are used for xr/yr and the texture angle.
// - the z axis is which direction the end is in.
// =
// - xr, yr: x/y radius
// - startsize, lathe
//   - lathe is an array of {size, h} objects, each representing one segment.
//   - h is how long the segment is, size is a scaler for the end of that
//     segment. startsize is a scaler for the beginning of the first segment.
// - h: getter/setter for the total height of all segments.
// - gap: a 0 to 1 number for how much is missing.
//   - the texture is scaled so all of it still displays, it's just compressed
//     to avoid this area.
// - roll: lets the texture start at a different angle than 0. shifts the gap,
//   too.
//   - a 0 to 1 number, NOT an angle.
//   - if you just rotate the shape, you can't choose where the gap and texture
//     are relative to the x/y scaling.
//   - if there's a gap, this represents the center of the gap.
	constructor() {
        super();
		this.xr = 1;
		this.yr = 1;
        this.startsize = 1;
		this.lathe = [];
        this.h = 1;
		this.gap = 0;
		this.roll = 0;
	}
    fixlathe() {
    // makes sure lathe is formatted correctly.
        for(let i1 = 0; i1 < this.lathe.length; i1++) {
            if(typeof this.lathe[i1] === "object") {
                this.lathe[i1] = {};
            }
            this.lathe[i1] = {
                size: typeof this.lathe[i1].size === "number" ? this.lathe[i1].size : 1,
                h: typeof this.lathe[i1].h === "number" ? this.lathe[i1].h : 1,
            };
        }
    }
    get h() {
        this.fixlathe();
        let h = 0;
        for(let i1 = 0; i1 < this.lathe.length; i1++) {
            h += this.lathe[i1].h;
        }
        return h;
    }
    set h(value) {
        if(typeof value !== "number") {
            return;
        };
        if(this.lathe.length) {
            let _h = this.h;
            if(_h) {
                let mod = value/_h;
                for(let i1 = 0; i1 < this.lathe.length; i1++) {
                    this.lathe[i1].h *= mod;
                }
            }
            else {
                for(let i1 = 0; i1 < this.lathe.length; i1++) {
                    this.lathe[i1].h = value/this.lathe.length;
                }
            }
        }
        else {
            this.lathe[0] = {size: this.startsize, h: value};
        };
    }
    get center() {
        return Points.add(this, Quat.apply(this.orient, [0, 0, this.h/2]));
    }
    get cache() {
    // various things that should be reused and not recalculated.
        let basis = this.basis;
        let _basis = structuredClone(basis);
        _basis[2] = Points.invert(_basis[2]);
        // used for cones that point the opposite way.
        this.fixlathe();
        let lathe = this.lathe;
        let rings = [Points.convert(this)];
        let tube_place = [0];
        // positions and line places of the centers of each ring.
        let slant = [0];
        // important for texturing.
        // - if you texture by z distance, things get weird and stretched if the
        //   lathe size is like, [0, 30, 10] or whatever
        // - so these are 0 to 1 numbers for where the ring is from top to
        //   bottom, but based on surface distance.
        let cone_tip = [];
        let cone_h = [];
        // the tips and heights of each segment's cone. (null if it's a
        // cylinder.)
        for(let i1 = 0; i1 < lathe.length; i1++) {
        // i1 = start of segment
        // i1 + 1 = end of segment
            tube_place[i1 + 1] = tube_place[i1] + lathe[i1].h;
            rings[i1 + 1] = Points.add(
                rings[i1],
                Points.multiply(basis[2], lathe[i1].h)
            );
            let prevsize = i1 ? lathe[i1].size : this.startsize;
            let diff = lathe[i1].size - prevsize;
            slant[i1 + 1] = slant[i1] + Math.hypot(lathe[i1].h, Math.abs(diff));
            if(diff) {
                // x is the tube_place of the cone tip relative to the previous
                // ring, y is the size.
                // y = prevsize + (diff/h)x
                // 0 = prevsize + (diff/h)x
                // -prevsize = (diff/h)x
                // x = -prevsize*h/diff
                let num = -prevsize*lathe[i1].h/diff;
                cone_tip[i1] = Points.add(
                    rings[i1],
                    Points.multiply(basis[2], num)
                );
                cone_h[i1] = Math.abs(num - tube_place[i1 + (diff >= 0)]);
            }
            else {
                cone_tip[i1] = null;
                cone_h[i1] = null;
            }
        };
        for(let i1 = 0; i1 < slant.length; i1++) {
            slant[i1] /= slant[slant.length - 1];
        }
        return {
            basis, _basis,
            rings, slant,
            cone_tip, cone_h
        };
    }
    coverage(index, cache) {
	// an array of 2d pixels the shape could be shown in.
        let r1 = index ? this.lathe[index - 1].size : this.startsize;
        let r2 = this.lathe[index].size;
        // scalings of both ends
        if(!this.xr || !this.yr || !this.lathe[index].h || (!r1 && !r2)) {
            return null;
        };
        let i1 = 0;
        let i2 = 0;
		let basis = this.basis;
		let x = basis[0];
		let y = basis[1];
		let z = basis[2];
        cache ??= this.cache;
        let ref = cache;
        let lathe = this.lathe;
        let x1 = ref.rings[index][0];
        let y1 = ref.rings[index][1];
        let x2 = ref.rings[index + 1][0];
        let y2 = ref.rings[index + 1][1];
        // positions of both ends.
        let data = {
            side1: null,
            side2: null,
            tube: null,
        };
        let angles = [
            get2dangle(x[0], x[1], true),
            get2dangle(y[0], y[1], true),
            get2dangle(z[0], z[1], true)
        ];
        if(angles[0] !== null && angles[1] !== null) {
            let temp = Round3D.ellipse_data(angles, [this.xr, this.yr, Math.sin(Math.acos(Math.hypot(z[0], z[1])))]);
            data.side1 = Round3D.ellipse_coverage(temp, x1, y1, r1);
            data.side2 = Round3D.ellipse_coverage(temp, x2, y2, r2);
        };
        let tangent = circcirctangent(x1, y1, r1, x2, y2, r2);
        if(tangent) {
        // circ1 + r1*cos_sin(angle - tangent[0])
        // circ2 + r2*cos_sin(angle - tangent[1])
        // circ2 + r2*cos_sin(angle + tangent[1])
        // circ1 + r1*cos_sin(angle + tangent[0])
            let angle = get2dangle(x2 - x1, y2 - y1);
            let points = [];
            for(i1 = 0; i1 < 4; i1++) {
                let temp = [(i1 === 1 || i1 === 2), (i1 === 0 || i1 === 1)];
                let point = Points.multiply(
                    temp[0] ? r2 : r1,
                    [
                        Math.cos(angle + (temp[1] ? -1 : 1)*tangent[Number(temp[0])]),
                        Math.sin(angle + (temp[1] ? -1 : 1)*tangent[Number(temp[0])])
                    ]
                );
                for(i2 = 0; i2 < 3; i2++) {
                // scale it by the xr and yr, and foreshorten
                    if(basis[i2][0] || basis[i2][1]) {
                        let _angle = get2dangle(basis[i2][0], basis[i2][1]);
                        point = Point2.stretch(
                            point, _angle,
                            i2 === 0 ? this.xr : i2 === 1 ? this.yr : Math.hypot(basis[i2][0], basis[i2][1])
                        );
                    }
                }
                points[i1] = Points.add(temp[0] ? [x2, y2] : [x1, y1], point);
            }
            data.tube = _2dPoly.getdata(points, true, Points.divide([x1 + x2, y1 + y2], 2));
        };
        if(!data.side1 && !data.side2 && !data.tube) {
            return null;
        };
        let rect = null;
        for(i1 in data) {
            if(data.hasOwnProperty(i1) && data[i1]) {
                rect = rect ? Rect.contain(rect, data[i1].rect) : structuredClone(data[i1].rect);
            }
        }
        if(!rect) {
            return null;
        }
        let within = [];
        let closer = Math.sign(ref.rings[index + 1][2] - ref.rings[index][2]);
        closer = closer === 1 ? 2 : closer === -1 ? 1 : 0;
        for(i1 = 0; i1 < rect.w*rect.h; i1++) {
            let coor = Raster.indextocoord(i1, rect);
            let temp = [
                data.tube ? Raster.findcoor(data.tube.within, data.tube.rect, ...coor) : false,
                data.side1 ? Raster.findcoor(data.side1.within, data.side1.rect, ...coor) : false,
                data.side2 ? Raster.findcoor(data.side2.within, data.side2.rect, ...coor) : false
            ];
            // any pixel that's within one of the two circles or their tangent area
            // should be checked for intersections, except:
            within[i1] = !!(
                (temp[0] || temp[1] || temp[2])
                &&
                (!temp[1] || !temp[2])
                // if it's within the overlap of both circles
                &&
                (this.doublesided || !closer || !data[closer])
                // if it's onesided, and within the closer end.
            );
        }
        return {rect, within};
	}
    intersect(index, line, cache) {
    // returns an object storing information about the point the line intersects
    // at, or null if it doesn't intersect it.
    // - return structure:
    //   - point
    //   - line_place
    //   - color: an array of 0-255 numbers.
    //   - normal
    // - index: which segment you're checking. omit it to have it check
    //   everything and return the intersection with the closest line_place.
    // - cache: save time by storing a this.cache and using it here, so it
    //   doesn't run that crap every time.
    // - intersections are discarded if they're from following the opposite
    //   direction of the line, or if doublesided is off and it only intersected
    //   the invalid side.
        let r1 = index ? this.lathe[index - 1].size : this.startsize;
        let r2 = this.lathe[index].size;
        // scalings of both ends
        if(!this.xr || !this.yr || !this.lathe[index].h || (!r1 && !r2)) {
            return null;
        };
        if(!Number.isInteger(index)) {
            let record = null;
            for(let i1 = 0; i1 < Math.max(1, this.lathe.length); i1++) {
                let temp = this.intersect(line, i1);
                if(temp && (!record || temp.line_place < record.line_place)) {
                    record = temp;
                };
            }
            return record;
        }
        cache ??= this.cache;
        let ref = cache;
        //
        let start = ref.rings[index];
        let end = ref.rings[index + 1];
        let intersect = [];
        if(r1 === r2) {
            intersect = line.cyl_intersect(start, ref.basis, r1*this.xr, r1*this.yr);
        }
        else {
            let inverse = r1 > r2;
            intersect = line.cone_intersect(
                ref.cone_tip[index], inverse ? ref._basis : ref.basis,
                (inverse ? r1 : r2)*this.xr, (inverse ? r1 : r2)*this.yr,
                ref.cone_h[index]
            );
        }
        for(let i1 = 0; i1 < intersect.length; i1++) {
            if(
                intersect[i1].line_place < 0
                // it's a ray intersect, not a line intersect
                ||
                (intersect[i1].exit && !this.doublesided)
                // inside to outside intersections are invalid without
                // doublesided
                ||
                (
                    ref.cone_tip[index]
                    ?
                    (
                        intersect[i1].cone_place < ref.cone_h[index] - this.lathe[index].h
                        ||
                        intersect[i1].cone_place >= ref.cone_h[index]
                    )
                    :
                    (
                        intersect[i1].cyl_place < 0
                        ||
                        intersect[i1].cyl_place >= this.lathe[index].h
                    )
                )
                // not within the partial-cone area
            ) {
                intersect.splice(i1, 1);
                i1--;
            }
        }
        if(intersect.length === 2) {
            let temp = intersect[1].line_place < intersect[0].line_place;
            intersect = intersect[Number(temp)];
            // point, angle, line_place, cone_place/cyl_place, exit
            // point, line_place, color, normal
            let normal = (
                intersect.angle === null ? [0, Math.PI/2] :
                // right on the central line. a zero-radius cylinder, or the
                // point of a cone. point it directly at the camera.
                ref.cone_tip[index] === null ? Angle.get(...Points.apply(ref.basis, [
                    Math.cos(intersect.angle),
                    Math.sin(intersect.angle),
                    0
                ])) :
                // cylinder: the angle is always relative to whatever point on
                // the center line is at the same z. so z is zero.
                Angle.get(...Point.cross(
                    Quat.apply(this.orient, [Math.cos(intersect.angle + Math.PI/2), Math.sin(intersect.angle + Math.PI/2), 0]),
                    // vector that's like... i don't know, if you were swinging
                    // something around circularly and let go. the direction
                    // it'd fly.
                    Points.subtract(intersect.point, ref.cone_tip[index])
                    // vector from the intersection to the tip
                ))
                // cone: cross products are perpendicular. i don't even think i
                // have to make sure it isn't inverted.
            );
            let color = null;
            let x = intersect.angle/(2*Math.PI) - (this.roll + this.gap/2);
            // - intersect angle is the 2d angle
            // - roll + gap/2 is how much to offset that by
            x /= 1 - this.gap;
            // scale so that the texture ends at the gap instead of the gap
            // hiding part of the texture
            if(x < 0 || x >= 1) {
            // inside the gap
                return null;
            }
            else {
                let y = (
                    ref.cone_tip[index] === null
                    ?
                    intersect.cyl_place/this.lathe[index].h
                    // cylinder
                    :
                    //y = (intersect.cone_place - (ref.cone_h[index] - this.lathe[index].h))/this.lathe[index].h;
                    (intersect.cone_place - ref.cone_h[index])/this.lathe[index].h + 1
                    // cone
                );
                y = slant[i1] + y*(slant[i1 + 1] - slant[i1]);
                color = this.texturecolor(x, y);
            }
            return {
                point: intersect.point,
                line_place: line_place,
                color,
                normal,
            };
        }
        else {
            return null;
        }
    }
}
class RoundRect extends Round3D {
// - w, h
// =
// - position is a corner of the rectangle.
// - x/y axes are vectors for w/h and texture x/y. (position is the top left
//   corner of the texture, position + width * basis[0] is the corner that
//   matches the top right corner of the texture, etc.)
// - z basis is the direction it faces
// =
// - ...rectangles aren't round, but consistency is a bitch. this isn't even a
//   shape that needs Infinite Fidelity...
	constructor() {
        super();
		this.w = 1;
		this.h = 1;
	}
    coverage() {
	// an array of 2d pixels the shape could be shown in.
        let i1 = 0;
        let i2 = 0;
		let basis = this.basis;
		let x = basis[0];
		let y = basis[1];
		let z = basis[2];
		if(
			!z[2]
			// seen entirely from the side, it'd just be an infintesimally
            // thin line
			||
			(!this.doublesided && z[2] < 0)
			// one-sided and facing away
		) {
			return null;
		};
    }
    get center() {
        return Points.add(
            Points.convert(this),
            Points.add(
                Quat.apply(this.orient, [this.w/2, 0, 0]),
                Quat.apply(this.orient, [0, this.h/2, 0])
            )
        );
    }
}
class RoundDisc extends Round3D {
// a flat circle/ellipse shape.
// - xr, yr
// =
// - position is the center of the disc
// - texture x is angle, texture y is where it is from center to edges
	constructor() {
        super();
		this.xr = 1;
		this.yr = 1;
	}
    coverage() {
	// an array of 2d pixels the shape could be shown in.
        let i1 = 0;
        let i2 = 0;
		let basis = this.basis;
		let x = basis[0];
		let y = basis[1];
		let z = basis[2];
		if(
			!z[2]
			// seen entirely from the side, it'd just be an infintesimally
            // thin line
			||
			(!this.doublesided && z[2] < 0)
			// one-sided and facing away
		) {
			return null;
		};
    }
}
class TriLamp {
// lighting object. it's meant to cast surfaces in a high level of light, mid
// level, or low level.
// - generally, low level means the surface is facing away, and high level means
//   light is shining almost directly on it.
// - r, g, b: the color of the light. these should be 0 to 1 numbers.
// - hi_threshold, lo_threshold: the directness of the light is something like
//   Math.cos(Angle.compare(angle to the lamp, surface normal)). that gives you
//   a -1 to 1 number... if it's higher than hi_threshold, it'll be high level.
//   lower than lo_threshold, low level.
// - hi_factor, lo_factor: each light level has its own color. hi_color is
//   [r^hi_factor, g^hi_factor, b^hi_factor]. etc.
    constructor(x, y, z, r, g, b, hi_threshold, lo_threshold, hi_factor, lo_factor) {
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.z = z ?? 0;
        this.r = r ?? 1;
        this.g = g ?? 1;
        this.b = b ?? 1;
        this.hi_threshold = hi_threshold ?? Math.sqrt(3)/2;
        this.lo_threshold = lo_threshold ?? 0;
        this.hi_factor = hi_factor ?? 1/4;
        this.lo_factor = lo_factor ?? 4;
        this.intensity = 1;
    }
    get hi_color() {
        return [
            this.r**this.hi_factor,
            this.g**this.hi_factor,
            this.b**this.hi_factor
        ];
    }
    get md_color() {
        return [
            this.r,
            this.g,
            this.b
        ];
    }
    get lo_color() {
        return [
            this.r**this.lo_factor,
            this.g**this.lo_factor,
            this.b**this.lo_factor
        ];
    }
    static getintensities(lamps, x, y, z) {
        let intensities = [];
        for(let i1 = 0; i1 < lamps.length; i1++) {
            intensities[i1] = 1/( Math.hypot(...Points.subtract(Points.convert(lamps[i1]), [x, y, z])) **2);
        }
        return intensities;
    }
    static colorcalc(lamps, x, y, z, r, g, b, normal, intensities) {
        let i1 = 0;
        r /= 255;
        g /= 255;
        b /= 255;
        let null_intensities = !Array.isArray(intensities) || intensities.length !== lamps.length;
        if(null_intensities) {
            intensities = [];
        }
        let groups = {hi: [], md: [], lo: []};
        // lamp indexes, sorted by how direct the angle is
        intensity_total = {hi: 0, md: 0, lo: 0};
        let sign = [];
        for(i1 = 0; i1 < lamps.length; i1++) {
            if(lamps[i1] instanceof TriLamp) {
                let vect = Points.subtract(Points.convert(lamps[i1]), [x, y, z]);
                let distance = Math.hypot(...vect);
                let num = distance ? Math.cos(Angle.compare(Angle.get(...vect), normal)) : 1;
                let group = num >= lamps[i1].hi_threshold ? "hi" : num <= lamps[i1].lo_threshold ? "lo" : "md";
                groups[group][ groups[group].length ] = i1;
                if(null_intensities) {
                    intensities[i1] = 1/(distance**2);
                }
                intensity_total[group] += intensities[i1];
            }
            else {
                intensities[i1] = null;
            }
        }
        let color = null;
        if(groups.md.length || groups.hi.length) {
            color = [r, g, b];
            // if it's in the mid range of at least one lamp, it should be the
            // color you expect.
            if(groups.md.length) {
            // but if those lamps are tinted, that should limit the values. (ie,
            // a white object looks orange if it's only within mid range of an
            // orange lamp.)
                let _color = [0, 0, 0];
                for(i1 = 0; i1 < groups.md.length; i1++) {
                // use a weighted system, where closer lamps' tint shows more
                    let __color = lamps[ groups.md[i1] ].md_color;
                    _color += intensities[ groups.md[i1] ]/intensity_total.md;
                }
                color[0] *= 1 - _color[0];
                color[1] *= 1 - _color[1];
                color[2] *= 1 - _color[2];
            };
            if(groups.hi.length) {
                let _color = [0, 0, 0];
                for(i1 = 0; i1 < groups.hi.length; i1++) {
                    color = Color.absencemultiply(...color, ...lamps[ groups.hi[i1] ].hi_color);
                }
            };
        }
        else if(groups.lo.length) {
            color = [0, 0, 0];
            for(i1 = 0; i1 < groups.lo.length; i1++) {
                color = Color.absencemultiply(...color, ...lamps[ groups.lo[i1] ].lo_color);
            }
            color[0] *= r;
            color[1] *= g;
            color[2] *= b;
            // decrease the absence of the "true" color by multiplying it.
        }
        else {
            color = [r, g, b];
        };
        for(i1 = 0; i1 < 3; i1++) {
            color[i1] = Math.round(255*(1 - color[i1]));
        }
        return color;
    }
}
class RoundScene {
    constructor(rounds, lamps) {
        this.rounds = rounds ?? [];
        this.lamps = lamps ?? [];
        this.pan_x = 0;
        this.pan_y = 0;
    }
    render(ctx) {
    // draws the rounds onto the canvas.
    // - NOTE: this does not clear the canvas.
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let rect = [ctx.canvas.width, ctx.canvas.height];
        rect = {
            x: Math.floor(-rect[0]/2 + this.pan_x),
            y: Math.floor(-rect[1]/2 + this.pan_y),
            w: rect[0],
            h: rect[1],
        };
        let intensities = [];
        // the way TriLamp works, the intensity of lighting effects depends on
        // how close it is. but i want that to be a flat effect, so have every
        // spot's lamp effects match the intensity they have on the shape
        // center.
        let intersects = {};
        // - [x coordinates]
        //   - [y coordinates]: arrays of intersections
        for(i1 = 0; i1 < this.rounds.length; i1++) {
            let ref = this.rounds[i1];
            if(ref instanceof RoundTube) {
                intensities[i1] = [];
                let cache = ref.cache;
                // reusable information
                for(i2 = 0; i2 < ref.lathe.length; i2++) {
                    intensities[i1][i2] = TriLamp.getintensities(this.lamps, ...Points.centroid(ref.cache.rings.slice(i2, i2 + 2)));
                    let coverage = ref.coverage(i2, cache);
                    // pixels it could be on
                    if(coverage) {
                        for(i3 = 0; i3 < coverage.within.length; i3++) {
                            if(coverage.within[i3]) {
                                let coor = Raster.indextocoord(i3, coverage.rect);
                                if(Rect.inside(rect, ...coor)) {
                                    let obj = ref.intersect(i2, new Line(coor[0] + .5, coor[1] + .5, 0, [0, -Math.PI/2]), cache)
                                    // {point, line_place, color, normal}
                                    if(obj) {
                                        intersects[coor[0]] ??= {};
                                        intersects[coor[0]][coor[1]] ??= [];
                                        intersects[coor[0]][coor[1]].push({
                                            obj: structuredClone(obj),
                                            round: i1, segment: i2,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else if(ref instanceof RoundRect) {
                intensities[i1] = TriLamp.getintensities(this.lamps, ...ref.center);
            }
            else if(ref instanceof Round3D) {
                intensities[i1] = TriLamp.getintensities(this.lamps, this.x, this.y, this.z);
            }
            else {
                console.log(".rounds should only have Round3Ds in it.");
            };
        }
        for(i1 = 0; i1 < rect.w; i1++) {
            for(i2 = 0; i2 < rect.h; i2++) {
                let x = rect.x + i1;
                let y = rect.y + i2;
                if(x in intersects && y in intersects[x]) {
                    intersects[x][y].sort((a, b) => a.obj.line_place - b.obj.line_place);
                    let array = intersects[x][y];
                    let obj = array[0];
                    let colors = [];
                    for(i3 = 0; i3 < array.length; i3++) {
                        let truecolor = array[i3].obj.color;
                        colors[i3] = TriLamp.colorcalc(
                            this.lamps,
                            // lamps
                            ...array[i3].obj.point,
                            // x, y, z
                            ...array[i3].obj.color.slice(0, 3),
                            // r, g, b
                            array[i3].obj.normal,
                            // normal
                            ("segment" in array[i3] ? intensities[array[i3].round][array[i3].segment] : intensities[array[i3].round])
                            // intensities
                        );
                        colors[i3].push(array[i3].obj.color[3]);
                        if(colors[i3][3] >= 255) {
                            i3 += array.length;
                        }
                    }
                    for(i3 = colors.length - 1; i3 >= 0; i3--) {
                        colors[i3][3] /= 255;
                        ctx.fillStyle = "rgba(" + colors[i3].join() + ")";
                        ctx.fillRect(i1, i2, 1, 1);
                    }
                }
            }
        }
    }
    static shirt(scale) {
        let i1 = 0;
        scale ??= 1;
        let shirt = new RoundScene();
        shirt.rounds.push(new RoundTube());
        shirt.rounds.push(new RoundTube());
        shirt.rounds.push(new RoundTube());
        let torso = shirt.rounds[0];
        torso.rotate("yz", 3*Math.PI/2);
        torso.yr = .5;
        torso.startsize = .5;
        torso.lathe = [
            {size: 1 + 1/2, h: 1/2},
            {size: 1, h: 3/4},
            {size: 1 + 1/4, h: 1 + 3/4},
        ];
        torso.scale(scale);
        // multiply all this by half the torso width
        let point = torso.center;
        Points.apply(Points.subtract(torso, torso.center), torso);
        for(i1 = 0; i1 < 2; i1++) {
            let sign = i1 ? 1 : -1;
            let sleeve = shirt.rounds[1 + i1];
            sleeve.yr = .5;
            sleeve.rotate("yz", 3*Math.PI/2);
            sleeve.rotate("xz", i1*Math.PI);
            sleeve.rotate("xy", sign*Math.atan(1/2));
            sleeve.scale(scale);
            let point = Points.subtract(torso.translate([-torso.xr*torso.lathe[0].size, 0, torso.lathe[0].h]), sleeve.translate([-sleeve.xr, 0, 0]));
            sleeve.x += point[0];
            sleeve.y += point[1];
            sleeve.z += point[2];
            // make their -x edges line up.
        }
        return shirt;
    }
}

let PreSuf = {
// functions related to my ui system of prefixes and suffixes.
    fullname: (prefix, suffix) => (prefix ?? "") + (prefix && suffix ? "_" : "") + (suffix ?? ""),
    get: function(fullname) {
        fullname = fullname.split("_");
        return [fullname[0], fullname.slice(1).join("_")];
    },
};
let Rect = {
// pseudoclass for rectangle objects. used in ui a lot.
    new: function(x, y, w, h) {
        return {
            x: x ?? 0,
            y: y ?? 0,
            w: w ?? 0,
            h: h ?? 0,
        };
    },
    fromedges: function(l, r, u, d) {
        let rect = {
            x: l ?? 0,
            y: u ?? 0,
            w: r ?? 0,
            h: d ?? 0,
        };
        rect.w -= rect.x;
        rect.h -= rect.y;
        return rect;
    },
    divide: function(rect, target, prefix, suffixes, horizontal) {
    // divides up the given rect and defines them as properties of target, named
    // with the prefix and suffixes.
        const axis = horizontal ? 0 : 1;
        const coor1 = "xy"[axis];
        const coor2 = "xy"[posmod(axis + 1, 2)];
        const dim1 = "wh"[axis];
        const dim2 = "wh"[posmod(axis + 1, 2)];
        prefix ??= "";
        for(let i1 = 0; i1 < suffixes.length; i1++) {
            if(typeof suffixes[i1] === "string") {
                const position = [
                    rect[coor1] + rect[dim1]*i1/suffixes.length,
                    rect[coor1] + rect[dim1]*(i1 + 1)/suffixes.length
                ];
                target[PreSuf.fullname(prefix, suffixes[i1])] = {
                    [coor1]: position[0],
                    [coor2]: rect[coor2],
                    [dim1]: position[1] - position[0],
                    [dim2]: rect[dim2],
                };
            }
        }
    },
    fromslice: function(rect, direction, dimension, target, prefix, suffix) {
    // slices away some of an edge, and optionally, makes a button from that
    // edge.
    // - if suffix is an array, it'll use divide.
    // - whether a button is created or not, it will return the rect it makes
    //   from the slice.
        let axis = direction === "u" || direction === "d" ? 1 : 0;
        let negative = direction === "r" || direction === "d";
        let _rect = structuredClone(rect);
        _rect["wh"[axis]] = dimension;
        if(negative) {
            _rect["xy"[axis]] += rect["wh"[axis]] - dimension;
        }
        if(typeof prefix === "string") {
            if(typeof suffix === "string") {
                target[PreSuf.fullname(prefix, suffix)] = structuredClone(_rect);
            }
            else if(Array.isArray(suffix)) {
                Rect.divide(_rect, target, prefix, suffix, !!axis);
            }
        }
        rect["wh"[axis]] -= dimension;
        if(!negative) {
            rect["xy"[axis]] += dimension;
        };
        return _rect;
    },
    expanded: function(rect, direction, amount) {
    // moves one edge.
        let _rect = structuredClone(rect);
        if(direction === "l" || direction === "r") {
            _rect.w += amount;
            if(direction === "l") {
                _rect.x -= amount;
            };
        }
        else if(direction === "u" || direction === "d") {
            _rect.h += amount;
            if(direction === "u") {
                _rect.y -= amount;
            };
        };
        return _rect;
    },
    expand_all: function(rect, amount) {
        amount ??= 1;
        return Rect.new(rect.x - amount, rect.y - amount, rect.w + 2*amount, rect.h + 2*amount);
    },
    neighbor: function(rect, direction, w, h) {
        let _rect = structuredClone(rect);
        _rect.w = w ?? _rect.w;
        _rect.h = h ?? _rect.h;
        _rect.x += direction === "l" ? -_rect.w : direction === "r" ? rect.w : 0;
        _rect.y += direction === "u" ? -_rect.h : direction === "d" ? rect.h : 0;
        return _rect;
    },
    contain: function(rect1, rect2) {
    // makes a rect that contains both specified rects.
        let x = [
            rect1.x, rect1.x + rect1.w,
            rect2.x, rect2.x + rect2.w
        ];
        let y = [
            rect1.y, rect1.y + rect1.h,
            rect2.y, rect2.y + rect2.h
        ];
        let _x = Math.max(...x);
        let _y = Math.max(...y);
        x = Math.min(...x);
        y = Math.min(...y);
        return {
            x: x,
            y: y,
            w: _x - x,
            h: _y - y,
        };
    },
    reach: function(rect, x, y) {
        let _rect = structuredClone(rect);
        if(typeof x === "number") {
            let l = Math.min(Rect.l(_rect), x);
            let r = Math.max(Rect.r(_rect), x);
            _rect.x = l;
            _rect.w = r - l;
        };
        if(typeof y === "number") {
            let u = Math.min(Rect.u(_rect), y);
            let d = Math.max(Rect.d(_rect), y);
            _rect.y = u;
            _rect.h = d - u;
        };
        return _rect;
    },
    l: (rect) => rect.x,
    r: (rect) => rect.x + rect.w,
    u: (rect) => rect.y,
    d: (rect) => rect.y + rect.h,
    edges: (rect) => [Rect.l(rect), Rect.r(rect), Rect.u(rect), Rect.d(rect)],
    ui: function(areas, omit) {
    // a very meaty function that creates an entire ui at once.
    // - that is, an object of rects, each representing a button, and named with
    //   a prefix and suffix.
    // - the omit argument lets you omit buttons.
    //   - an object of suffix arrays, indexed by prefix.
    //   - or if a property is just true, that entire prefix will be omitted.
    // - the point is not just to create ui quickly, but to allow it to be
    //   *modular.* for example, i'm using this on DrawApp so i can hide drawing
    //   tools that aren't especially relevant to whatever i'm putting DrawApp
    //   in.
    // - areas is an array. each item represents one area of a ui, ex "the area
    //   with all the settings buttons".
    //   - prefix: the prefix all buttons of this area have.
    //   - previous: the index of the area its position is relative to.
    //     - it must be an index lower than this item's index.
    //     - -1 is interpreted as "the index 1 before this index", -2 is 2
    //       before, etc
    //   - direction: letter for whether it should be a right neighbor, left
    //     neighbor, what
    //   - gap: 1 means a gap 1 wide between it and the previous area, 0 means
    //     no gap, -1 means overlap, etc.
    //   - adjust: how many units to move it in the opposite axis.
    //   - if any of those are omitted, it'll assume -1 for previous, 1 for gap,
    //     and 0 for adjust.
    //     - direction will be whatever the previous' direction was, or "r" if
    //       it's the first area.
    //       - previous as in "area it's positioned relative to", i mean.
    //   - and of course, none of this has any meaning for the first area.
    //   - first (explained later)
    //     - suffix
    //     - w, h
    //     - horizontal
    //   - actions: an array of button-creating actions.
    //     - the buttons of an area are created by starting with a rectangle,
    //       and modifying it. by the end, this rectangle will represent the
    //       space all the buttons are within.
    //     - don't think too hard about x/y coordinates right now. it'll be
    //       adjusted later so that areas only overlap as much as you wanted
    //       with your gap/adjustment values. if gap is 1 or 0, it won't overlap
    //       with its previous no matter what.
    //     - first, the "first" property is used to create the first
    //       buttons.
    //       - suffix, w, and h are self-explanatory
    //       - suffix can be an array instead of one suffix. it'll create
    //         creates and h represent the dimensions of *one* of these
    //         buttons. it'll make a column, or if horizontal exists and is
    //         true, a row.
    //       - the area rectangle will then represent this button, column, or
    //         row.
    //     - from there, there are four main function-like actions.
    //       - ["row"/"column", suffixes, direction, w, h]
    //         - this creates a row or column of buttons, and expands the area
    //           to fit them.
    //         - this expands the area, and creates buttons from it.
    //         - direction is which side it uses
    //         - w and h are the dimensions of one button.
    //       - ["expand", suffix, direction, amount, horizontal]
    //         - expands the area by moving an edge. if suffix is valid, it will
    //           create button(s) from the expansion.
    //         - useful for making gaps between buttons.
    //         - cannot be used to shrink it. just order your actions better,
    //           scrub.
    //         - what makes this distinct from row/column is that one dimension
    //           is whatever the area's dimensions currently are. depending on
    //           what buttons are omitted, it might be better to use row/column
    //           so the dimensions are the same no matter what.
    //       - ["subtract", suffix, direction, amount]: subtracts from the edges
    //         of an already-created button.
    //         - you cannot use this to expand buttons.
    //       - ["align", suffix, direction]: this is used to create buttons that
    //         span the entire ui. after the button-creation phase is over and
    //         it figures out all the coordinates of the buttons, this button
    //         will be expanded so its right edge aligns with the further right
    //         edge of all the buttons, or its left edge, or whatever.
    //   - heading: if this exists, it'll make a heading button after all the
    //     actions. it should be a number, for the height.
    // - simplified:
    //   - prefix
    //   - previous, direction, gap, adjust
    //   - first
    //     - suffix
    //     - w, h
    //     - horizontal
    //   - actions
    //     - ["row"/"column", suffixes, direction, w, h]
    //     - ["expand", suffix, direction, amount, horizontal]
    //     - ["subtract", suffix, direction, amount]
    //     - ["align", suffix, direction]
    //   - heading
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        omit = (
            typeof omit === "string" ? {[omit]: true} :
            Array.isArray(omit) ? {"": omit} :
            typeof omit === "object" ? omit :
            {}
        );
        for(i1 in omit) {
            if(omit.hasOwnProperty(i1)) {
                if(omit[i1] === true) {
                    for(i2 = 0; i2 < areas.length; i2++) {
                        if((areas[i2].prefix ?? null) === i1) {
                            areas.splice(i2, 1);
                            i2--;
                        }
                    }
                }
            }
        }
        let isdirection = (direction) => typeof direction === "string" && direction.length === 1 && "lrud".includes(direction);
        let omitsuffixes = function(omit_array, suffix_array) {
            for(let i1 = 0; i1 < suffix_array.length; i1++) {
                if(omit_array.includes(suffix_array[i1])) {
                    suffix_array.splice(i1, 1);
                    i1--;
                }
            }
        };
        for(i1 = 0; i1 < areas.length; i1++) {
            let input = structuredClone(areas[i1]);
            areas[i1] = {
                prefix: input.prefix ?? "",
                x: null,
                y: null,
                w: null,
                h: null,
                previous: typeof input.previous && Number.isInteger(input.previous) && input.previous < i1 && i1 + input.previous >= 0 ? input.previous : -1,
                // - non-integers are invalid.
                // - numbers higher than the current index are invalid.
                // - numbers that create a negative number if combined with the
                //   current index are invalid
                // - use -1 if it's invalid.
                direction: null,
                gap: typeof input.gap === "number" ? input.gap : 1,
                adjust: typeof input.adjust === "number" ? input.adjust : 0,
                buttons: {},
            };
            let obj = areas[i1];
            let _omit = omit[obj.prefix] ?? [];
            obj.previous = obj.previous < 0 ? i1 + obj.previous : obj.previous;
            // if it's negative, count backwards from the current index.
            // - it's possible for it to be -1 after this if this is area 0 and
            //   input.previous was -1 or invalid. but input.previous is ignored
            //   for area 0 anyway.
            obj.direction = isdirection(input.direction) ? input.direction : obj.previous >= 0 ? areas[obj.previous].direction : "r";
            let rect = {x: 0, y: 0, w: 0, h: 0};
            if(input.hasOwnProperty("first")) {
                rect.w = input.first.w ?? rect.w;
                rect.h = input.first.h ?? rect.h;
                if(typeof input.first.suffix === "string") {
                // one button
                    obj.buttons[input.first.suffix] = structuredClone(rect);
                }
                else if(Array.isArray(input.first.suffix)) {
                // row/column of buttons
                    let suffix = input.first.suffix;
                    let axis = input.first.horizontal ? 0 : 1;
                    omitsuffixes(_omit, suffix);
                    for(i2 = 0; i2 < suffix.length; i2++) {
                        if(typeof suffix[i2] === "string") {
                            let _rect = structuredClone(rect);
                            _rect["xy"[axis]] += i2*_rect["wh"[axis]];
                            obj.buttons[suffix[i2]] = structuredClone(_rect);
                        }
                    }
                    rect["wh"[axis]] *= suffix.length;
                }
            };
            if(!rect.w || !rect.h) {
                //console.log("either there is no first button for " + (obj.prefix ? "the " + obj.prefix + " area" : "area " + i1) + ", or one of the dimensions is missing/zero, or the first button(s) have been omitted. whatever it is, that's probably why it looks weird or buttons are missing.");
                // there's a good chance of this being intentional... since
                // first doesn't fit very well into the omit system.
            };
            if(!Array.isArray(input.actions)) {
                input.actions = [];
            };
            if(typeof input.heading === "number" && input.heading > 0) {
                input.actions[ input.actions.length ] = ["expand", "heading", "u", input.heading];
            };
            //console.log(obj.prefix);
            for(i2 = 0; i2 < input.actions.length; i2++) {
                let array = input.actions[i2];
                let error = "invalid action: area " + i1 + " action " + i2 + ".";
                if(!array.length) {
                    console.log(error);
                }
                else if(array[0] === "row" || array[0] === "column") {
                // suffixes, direction, w, h
                    let axis = Number(array[0] === "column");
                    let suffixes = typeof array[1] === "string" ? [array[1]] : Array.isArray(array[1]) ? structuredClone(array[1]) : null;
                    let direction = isdirection(array[2]) ? array[2] : null;
                    let w = typeof array[3] === "number" ? array[3] : null;
                    let h = typeof array[4] === "number" ? array[4] : null;
                    if(suffixes === null || direction === null || w === null || h === null) {
                        console.log(error);
                    }
                    else {
                        let _rect = Rect.neighbor(rect, direction, w, h);
                        omitsuffixes(_omit, suffixes);
                        for(i3 = 0; i3 < suffixes.length; i3++) {
                            if(typeof suffixes[i3] === "string") {
                                let __rect = structuredClone(_rect);
                                obj.buttons[suffixes[i3]] = structuredClone(_rect);
                                obj.buttons[suffixes[i3]]["xy"[axis]] += _rect["wh"[axis]]*i3;
                            }
                        }
                        _rect["wh"[axis]] *= suffixes.length;
                        rect = Rect.contain(rect, _rect);
                    };
                }
                else if(array[0] === "expand") {
                // suffix, direction, amount, horizontal
                    let direction = isdirection(array[2]) ? array[2] : null;
                    let amount = array[3] ?? 1;
                    if(direction && amount >= 0) {
                        let suffix = typeof array[1] === "string" ? [array[1]] : Array.isArray(array[1]) ? structuredClone(array[1]) : null;
                        let horizontal = !!array[4];
                        if(suffix !== null) {
                            omitsuffixes(_omit, suffix);
                            if(suffix.length) {
                                let _rect = [null, null];
                                _rect[(direction === "u" || direction === "d") ? 1 : 0] = amount;
                                _rect = Rect.neighbor(rect, direction, ..._rect);
                                Rect.divide(_rect, obj.buttons, "", suffix, horizontal);
                            };
                        };
                        if(suffix === null || suffix.length) {
                        // only omit the expansion entirely if there were
                        // buttons, but all of them were omitted.
                            rect = Rect.expanded(rect, direction, amount);
                        };
                    }
                    else {
                        console.log(error + " (negative and non-number amounts are invalid.)");
                    };
                }
                else if(array[0] === "subtract") {
                // suffix, direction, amount
                    let amount = array[3] ?? 1;
                    if(amount >= 0) {
                        if(obj.buttons.hasOwnProperty(array[1] ?? null)) {
                            obj.buttons[array[1]] = Rect.expanded(obj.buttons[array[1]], array[2] ?? null, -amount);
                        }
                        else {
                            console.log(error);
                        }
                    }
                    else {
                        console.log(error + " (negative and non-number amounts are invalid.)");
                    }
                }
                else if(array[0] === "align") {
                // suffix, direction
                    if(isdirection(array[2]) && obj.buttons.hasOwnProperty(array[1] ?? null)) {
                        obj.buttons[array[1]].align ??= "";
                        obj.buttons[array[1]].align += array[2];
                    }
                }
            }
            // all the buttons should be made now.
            for(i2 in obj.buttons) {
                if(obj.buttons.hasOwnProperty(i2)) {
                // make it so none of their positions are negative.
                    obj.buttons[i2].x -= rect.x;
                    obj.buttons[i2].y -= rect.y;
                    obj.buttons[i2].align ??= "";
                    if(
                        Rect.l(obj.buttons[i2]) < 0
                        ||
                        Rect.r(obj.buttons[i2]) > rect.w
                        ||
                        Rect.u(obj.buttons[i2]) < 0
                        ||
                        Rect.d(obj.buttons[i2]) > rect.h
                    ) {
                        console.log("this shouldn't happen");
                    }
                };
            }
            obj.w = rect.w;
            obj.h = rect.h;
        }
        let buttons = {};
        let range = {l: 0, r: 0, u: 0, d: 0};
        for(i1 = 0; i1 < areas.length; i1++) {
        // create buttons from the areas
            let obj = areas[i1];
            if(i1) {
            // position it
                let previous = areas[obj.previous];
                let direction = obj.direction;
                let temp = Rect.neighbor(previous, direction, obj.w, obj.h);
                obj.x = temp.x + (direction === "l" ? -1 : direction === "r" ? 1 : 0)*obj.gap;
                obj.y = temp.y + (direction === "u" ? -1 : direction === "d" ? 1 : 0)*obj.gap;
                obj["xy"[Number(direction === "l" || direction === "r")]] += obj.adjust;
            }
            else {
                obj.x = 0;
                obj.y = 0;
            }
            for(i2 in obj.buttons) {
                if(obj.buttons.hasOwnProperty(i2)) {
                    let name = PreSuf.fullname(obj.prefix, i2);
                    buttons[name] = structuredClone(obj.buttons[i2]);
                    buttons[name].x += obj.x;
                    buttons[name].y += obj.y;
                    range.l = Math.min(range.l, Rect.l(buttons[name]));
                    range.r = Math.max(range.r, Rect.r(buttons[name]));
                    range.u = Math.min(range.u, Rect.u(buttons[name]));
                    range.d = Math.max(range.d, Rect.d(buttons[name]));
                }
            }
        }
        range = {
            x: range.l,
            y: range.u,
            w: range.r - range.l,
            h: range.d - range.u,
        };
        for(i1 in buttons) {
            if(buttons.hasOwnProperty(i1)) {
                buttons[i1].x -= range.x;
                buttons[i1].y -= range.y;
                // make sure the minimum x/y is 0
                let align = buttons[i1].align;
                delete buttons[i1].align;
                if(align.includes("l")) {
                    buttons[i1] = Rect.reach(buttons[i1], 0);
                };
                if(align.includes("r")) {
                    buttons[i1] = Rect.reach(buttons[i1], range.w);
                };
                if(align.includes("u")) {
                    buttons[i1] = Rect.reach(buttons[i1], null, 0);
                };
                if(align.includes("d")) {
                    buttons[i1] = Rect.reach(buttons[i1], null, range.h);
                };
                // align
            }
        }
        return buttons;
    },
    inside: (rect, x, y, alledges) => (
        x >= Rect.l(rect) && (alledges ? x <= Rect.r(rect) : x < Rect.r(rect))
        &&
        y >= Rect.u(rect) && (alledges ? y <= Rect.d(rect) : y < Rect.d(rect))
    ),
    inside_multi: function(obj, x, y, alledges) {
    // checks a whole object of rectangles for which one the coordinates are
    // inside. used in ui.
        for(let i1 in obj) {
            if(obj.hasOwnProperty(i1) && Rect.inside(obj[i1], x, y, alledges)) {
                return i1;
            }
        }
        return null;
    },
    center: (rect) => [rect.x + rect.w/2, rect.y + rect.h/2],
    fauxstroke: function(rect, ctx) {
        let temp = ctx.fillStyle;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(rect.x, rect.y, rect.w + 1, 1);
        ctx.fillRect(rect.x, rect.y, 1, rect.h + 1);
        ctx.fillRect(rect.x, rect.y + rect.h, rect.w + 1, 1);
        ctx.fillRect(rect.x + rect.w, rect.y, 1, rect.h + 1);
        ctx.fillStyle = temp;
    },
    abs: function(rect) {
        let temp = [Rect.l(rect), Rect.u(rect)];
        return {
            x: temp[0],
            y: temp[1],
            w: Rect.r(rect) - temp[0],
            h: Rect.d(rect) - temp[1],
        };
    },
    round_in: (rect) => Rect.fromedges(
        Math.ceil(Rect.l(rect)),
        Math.floor(Rect.r(rect)),
        Math.ceil(Rect.u(rect)),
        Math.floor(Rect.d(rect))
    ),
    // rounds edges to integers in whichever direction will make the rectangle
    // smaller.
    round_out: (rect) => Rect.fromedges(
        Math.floor(Rect.l(rect)),
        Math.ceil(Rect.r(rect)),
        Math.floor(Rect.u(rect)),
        Math.ceil(Rect.d(rect))
    ),
    // rounds edges to integers in whichever direction will make the rectangle
    // bigger.
    getcoor: (_this, index) => (
        (!Number.isInteger(index) || index < 0 || index >= _this.w*_this.h) ? null :
        [
            _this.x + index%_this.w,
            _this.y + Math.floor(index/_this.w)
        ]
    ),
    getindex: (_this, x, y) => (
        (
            x < _this.x || x >= _this.x + _this.w
            ||
            y < _this.y || y >= _this.y + _this.h
        ) ? -1 :
        _this.w*(Math.floor(y) - _this.y) + (Math.floor(x) - _this.x)
    ),
}
class DrawApp {
// used to create drawing apps, for use in various tools.
// - the DrawApp object attaches itself to existing canvases, manages variables,
//   reacts to clicks, draws ui, etc.
    constructor(canvas, ui_canvas, focusname) {
    // - canvas, ui_canvas: <canvas> elements
    // - focusname: used in the global userfocus variable, which is necessary
    //   for knowing which tool key presses should be used in.
        if(canvas instanceof HTMLCanvasElement && ui_canvas instanceof HTMLCanvasElement && typeof focusname === "string") {
        }
        else {
            console.log("do not skip arguments in the DrawApp class. (the variables might be the wrong type, too.)");
        };
        this._ctx = canvas.getContext("2d");
        this._ui_ctx = ui_canvas.getContext("2d");
    }
    get ctx() {
        return this._ctx;
    }
    get ui_ctx() {
        return this._ui_ctx;
    }
    // no setters, because you aren't supposed to change these.
    static block = 8
    // unit of measurement in ui creation.
    static buttons_template = {

    }
    ui_create() {

    }
}

function buttontext(settings, ctx, rect, text, right_text, centering) {
    let old_fill = ctx.fillStyle;
    let old_align = ctx.textAlign;
    //
    ctx.fillStyle = ctx.strokeStyle;
    let align = centering ? "center" : "left";
    ctx.textAlign = align;
    let center = Rect.center(rect);
    settings ??= {};
    const char_w = settings.char_w ?? 4;
    const char_h = settings.char_h ?? 8;
    const margin_x = settings.margin_x ?? 2;
    const margin_y = settings.margin_y ?? 1;
    let text_x = (rect, align, text) => Math.floor(rect.x + (
        align === "center" ? rect.w/2 :
        align === "right" ? rect.w - margin_x :
        margin_x
    )) + (align === "center" && !((text.length*(char_w + 1) - 1)%2) ? .5 : 0);
    //
    if(Array.isArray(text)) {
        const start_y = Math.floor(center[1] - char_h*(text.length - 1)/2 + margin_y);
        for(i2 = 0; i2 < text.length; i2++) {
            const start_x = text_x(rect, align, text[i2]);
            const coor = [
                start_x,
                start_y + i2*char_h
            ];
            ctx.fillText(
                text[i2],
                ...coor
            );
            if(right_text || right_text === 0) {
                const right_edge = text_x(rect, "right", right_text[i2]);
                ctx.textAlign = "right";
                ctx.fillText(
                    right_text[i2],
                    right_edge,
                    coor[1]
                );
                ctx.textAlign = align;
            };
        };
    }
    else {
        ctx.fillText(text, text_x(rect, align, text), center[1] + margin_y);
        if(right_text || right_text === 0) {
            ctx.textAlign = "right";
            ctx.fillText(
                right_text,
                text_x(rect, "right", right_text),
                center[1] + margin_y
            );
        };
    };
    //
    ctx.fillStyle = old_fill;
    ctx.textAlign = old_align;
}

class CellToy {
// an html class for creating an interactable game of life style cellular
// automata.
// - structure:
//   - html: an object of references to various html elements. this is used in
//     lieu of ids.
//   - getters/setters linked to html elements and their values
//     - w, h: canvas size
//     - dead_color, alive_colors
//   - ctx
//   - _paused, paused: value, getter/setter. (the getter/setter just changes
//     the pause button's text)
//   - values: array of values for each pixel of the grid. true if the cell is
//     alive, false if it's dead.
    constructor(container) {
        let i1 = 0;
        let i2 = 0;
        if(!(container instanceof HTMLElement)) {
            console.log("invalid input. you must give an html container for everything to go inside.");
            return;
        };
        this.html = {};
        this.html.container = container;
        let text = [
            "<canvas></canvas>",
            "<br><label><input type=\"checkbox\" name=\"tint\" checked> tint</label>",
            "<label><input type=\"checkbox\" name=\"afterimages\" checked> afterimages</label>",
            "<br><button name=\"save image\">save image</button>",
            "<br><label>rules: <input type=\"text\" name=\"rules\" value=\"3 / 23\" style=\"width: 25em\"></label>",
            "<label><input type=\"checkbox\" name=\"birth allowed\" checked> birth</label>",
            "<label><input type=\"checkbox\" name=\"death allowed\" checked> death</label>",
            "<br><button name=\"pause\">play</button> <button name=\"advance\">advance</button>",
            "<br><button name=\"clear\">clear</button> <button name=\"save\">save</button> <button name=\"load\">load</button>",
            "<br><button name=\"noise\">noise</button> <label><input type=\"text\" name=\"noise level\" style=\"width: 6em\" value=\"1/2\"></label>",
            "<br><label>script: <button name=\"execute\">execute</button>",
            "<br><textarea name=\"scripting\" rows=18 cols=48></textarea></label>",
            //"<details>\n\t<summary>tools</summary>\n\t<ul>\n\t\t" + [
            //].join("\n<br>").replaceAll("\n", "\n\t\t") + "\n\t</ul>\n</details>",
            "<details>\n\t<summary>settings</summary>\n\t<ul>\n\t\t" + [
                "<button name=\"change size\">change size</button>",
                "<label>fps: <input type=\"number\" style=\"width: 4em\" name=\"fps\" value=12></label>",
                "<label>dead color: <input type=\"text\" name=\"dead color\" value=\"white\"></label>",
                "<label>alive colors:<br><textarea rows=6 cols=16 name=\"alive colors\" name=\"#000\n#BBB\n#DDD\"></textarea></label>",
                "<label>birth tint: <input type=\"text\" name=\"birth tint\" value=\"#00FF0055\"></label>",
                "<label>death tint: <input type=\"text\" name=\"death tint\" value=\"#FF00FFAA\"></label>",
                "grid:\n<ul>\n\t" + [
                    "<label>cell: <input type=\"number\" name=\"grid cell\" style=\"width: 4em\" value=2></label> <label>border: <input type=\"number\" name=\"grid border\" style=\"width: 4em\" value=0></label>",
                    "<label>color: <input type=\"text\" name=\"grid color\" value=\"#00000000\"></label>"
                ].join("\n\t<br>") + "\n</ul>"
            ].join("\n<br>").replaceAll("\n", "\n\t\t") + "\n\t</ul>\n</details>",
            "<details>\n\t<summary>script system</summary>\n\t" + arraytoul([
                "i wrote a very tiny language for spawning cells. it centers around moving a cursor, and spawning cells relative to it.",
                "it sounds frivolous, but spawning cells is an ordeal even with a mouse, let alone a touchscreen. this gives much more control.",
                "actions:",
                [
                    "\"center\": moves the cursor to the center of the field.",
                    "\"move [x] [y]\": moves the cursor.",
                    [
                        "if x and y are integers, it'll move that many cells.",
                        "if x and y are fractions or decimals, it'll be interpreted as a fraction of the field's width/height."
                    ],
                    "\"move to [x] [y]: moves to an exact position. (as opposed to moving relative to the cursor's current position.) works the same as move.",
                    "\"birth [w] [h] [x] [y]\": spawns cells.",
                    [
                        "you can omit some or all of these numbers.",
                        "\"birth\" will spawn one cell, at the current position.",
                        "\"birth 1 3\" will spawn a 1x3 column of pixels.",
                        "\"birth 1 3 -2 7\" will spawn a 1x3 column of pixels, but shifted 2 left and 7 down. (the cursor doesn't move.)",
                        "just like move, you can use fractions for x and y."
                    ],
                    "\"death [w] [h] [x] [y]\": kills cells. works exactly the same.",
                    "\"mark\", \"return\": mark saves the cursor's current position. return brings the cursor back to that position.",
                    "\"loop [number]\": indent the lines after it, and those lines will be executed as many times as the given number. loops can be nested.",
                    "\"mirror x [x] [y]\", \"mirror y [x] [y]\", \"mirror xy [x] [y]\": helps you form symmetrical constructs.",
                    [
                        "it works like loop, in that it expects indented lines afterward, which mirroring will be applied to.",
                        "that block of code is executed twice. the first time, it works like normal.",
                        "the second time, it first goes back to where it was before the mirror block started, adds the offset you specify with [x] and [y], (optional) then...",
                        "every movement or edit after that will be mirrored relative to that spot."
                    ]
                ],
                "after a loop or mirror block ends, it'll go back to where it was before the loop started.",
                "you can write \"random\" in place of any coordinates to use a random position anywhere on the grid.",
                "write \"//\" to make the rest of the line a comment. (ignored by the interpreter.)"
            ]).replaceAll("\n", "\n\t") + "\n</details>",
            "<details>\n\t<summary>exception system</summary>\n\t" + arraytoul([
                "the basic format for rules is that you specify what numbers of alive neighbors will allow a cell to give birth, and what numbers of alive neighbors will allow a cell to survive.",
                "but i added a system that lets you add exceptions to these rules.",
                "for example, \"d141:2\".",
                "d141 describes an exact combination of which cells are alive.",
                [
                    "d means to first assume all neighbors are dead.",
                    "every number represents one alive cell. the number represents how many spots clockwise it is, relative to the previous alive cell. (or relative to the right, if it's the first number.)",
                    "start from the right...",
                    "1. move one spot clockwise, to down-right. make down-right alive.",
                    "4. move four spots clockwise. we start from down-right, so up-left. up-left is alive.",
                    "1. move one spot clockwise. up is alive.",
                    "down-right, up-left, and up are alive. all others are dead.",
                    "if it used an a instead of a d, we would assume all neighbors are alive, and would make them dead. this is more efficient for combinations with more than 4 living neighbors.",
                    "every combination can be simplified to an a/d letter and 4 numbers or less."
                ],
                "if a cell's neighbors meet that exact combination of being alive/dead, it'll do the opposite of whatever the rules originally said.",
                ":2 describes how you want this combination to be cycled around.",
                [
                    "more often than not, if you want an exception for one combination, you want it for all similar combinations too. any combination that's the same thing, just rotated around.",
                    "by default, it assumes you want this. d04 would create an exception for any combination where there's only two alive neighbors that are on opposite sides.",
                    "but if you don't, you have plenty of control over it.",
                    ":0 avoids cycling entirely.",
                    ":1 cycles by 1, 8 times. this is the default, if you don't write a : number.",
                    ":2 cycles by 2, 4 times. d0:2 would apply to cells with one cardinal neighbor. d1:2 would apply to cells with one diagonal neighbor.",
                    ":4 cycles by 4, twice."
                ],
                "ambiguity",
                [
                    "if you write a rule like \"d02?2:0\"...",
                    "d022:0 would mean that a cell matches the exception if the right, down, and left neighbors are alive, and all others are dead.",
                    "but adding that question mark changes it so that down can be alive OR dead. in either case, the exception will apply."
                ],
                "if you want to specify which kind of exception it is, you can write a + or - before the a/d.",
                [
                    "+ means \"cells that match this formation should be considered within the rules\". - means they shouldn't. you're adding or subtracting to what conditions allow birth/death.",
                    "if there's no sign, it assumes it should just be changed to the opposite of what it was.",
                    "this is usually unnecessary. it's just for clarity's sake.",
                    "except for ambiguity. it's useful for ambiguity. for example, in d02?2... the ambiguity means exceptions are made for two combinations. one of them has 2 neighbors, one of them has 3. while writing it, you're probably trying to make sure that if it matches, it survives, or trying to make sure it doesn't. but what if cells with 2 neighbors usually survive and cells with 3 usually don't? what it actually causes is \"if it matches, make it have the opposite fate of whatever the rules said before\"."
                ],
                "and/or exceptions",
                [
                    "a different kind of exception. +/- signs can still be used, but that's about all that carries over.",
                    "here's an example: \"+or(dl, dr)\".",
                    "dl and dr stand for down-left and down-right. what this exception means is, any cell with an alive down-left neighbor or an alive down-right neighbor qualifies for birth/survival.",
                    "and(dl, dr) would mean a cell qualifies if both down-left and down-right are alive...",
                    "there's also !and and !or. it's the same, except a cell only passes if they would fail. (!and means it qualifies unless dl and dr are alive, !or means it qualifies if neither dl or dr are alive.)",
                    "these exceptions are useful for making the automata move in a certain direction. for example, -!or(dl, d, dr) means birth can only happen if at least one neighbor is dl, d, or dr. new cells are always above the cells that spawned them, so growth always moves upward.",
                    "you can add plusses to directions to also include the directions next to them. for example, +and(d+) is the same as +and(dl, d, dr), and +or(r++) is the same as +or(u, ur, r, dr, d)."
                ]
            ]).replaceAll("\n", "\n\t") + "\n</details>"
        ].join("\n");
        //bm.ctx.canvas.style = "width: " + Math.ceil(1*bm.ctx.canvas.width) + "px"
        container.innerHTML = text;
        this.html = {
            canvas: container.querySelector("canvas"),
            color: {},
        }
        let array = [];
        let temp = container.querySelectorAll("input");
        for(i1 = 0; i1 < temp.length; i1++) {
            array.push(temp[i1]);
        }
        temp = container.querySelectorAll("textarea");
        for(i1 = 0; i1 < temp.length; i1++) {
            array.push(temp[i1]);
        }
        for(i1 = 0; i1 < array.length; i1++) {
            let name = array[i1].name ?? "";
            if(name.endsWith("color")) {
                this.html.color[name.slice(0, -"color".length).trim()] = array[i1];
            }
            else if(name.endsWith("colors")) {
                this.html.color[name.slice(0, -"colors".length).trim()] = array[i1];
            }
            else {
                this.html[name.replaceAll(" ", "_")] = array[i1];
            }
        }
        //this.html.color.alive.value = "#000\n#555\n#AAA";
        this.html.color.alive.value = "#000\n#BBB\n#DDD";
        this.html.scripting.value = [
            "center",
            "mirror y 0 -1",
            "\t" + [
                "birth 2 1 -2 0",
                "birth 1 1 -2 1",
                "birth 2 1 -5 0",
                "birth 1 3 0 1",
                "move -2 4",
                "birth",
                "birth 1 1 -1 -1",
                "move -2",
                "birth 1 3",
                "birth 1 1 -1 1",
                "move -3",
                "birth 2 1",
                "move -1 1",
                "birth",
                "move -1 1",
                "birth",
                "move 1 1",
                "birth",
                "move 1 1",
                "birth",
                "move 1 -1",
                "birth 2 1",
                "move 0 8",
                "mirror x",
                "\t" + [
                    "move -2",
            		"birth",
            		"birth 1 1 -2",
            		"birth 1 1 0 3",
            		"move -3 4",
            		"birth 1 -4",
            		"birth 3 1"
                ].join("\n\t\t")
            ].join("\n\t")
        ].join("\n");
        this.html.scripting.onkeydown = tabhandler;
        let buttons = container.querySelectorAll("button");
        for(i1 = 0; i1 < buttons.length; i1++) {
            this.html[buttons[i1].name.replaceAll(" ", "_")] = buttons[i1];
        }
        //
        this._w = 128;
        this._h = 128;
        let canvas = this.html.canvas;
        this.ctx = canvas.getContext("2d");
        canvas.style = "image-rendering: crisp-edges; touch-action: none";
        this._paused = true;
        //
        this.values = [];
        temp = this.w*this.h;
        for(i1 = 0; i1 < temp; i1++) {
            this.values.push(0);
        };
        this.formation = structuredClone(this.values);
        this.history = [];
        //
        this.interval = null;
        //
        let _this = this;
        canvas.onclick = function(e) {
            _this.paused = true;
            let x = Math.floor(e.clientX - e.target.getBoundingClientRect().left);
    		let y = Math.floor(e.clientY - e.target.getBoundingClientRect().top);
            x = Math.floor(x/(_this.grid_size));
            y = Math.floor(y/(_this.grid_size));
            if(x < _this.w && y < _this.w) {
            // don't do anything if they click the right/bottom edge of the
            // right/bottom cells.
                let index = y*_this.w + x;
                _this.values[index] = Number(!_this.values[index]);
                _this.refresh();
            }
        }
        this.html.pause.onclick = function(e) {
            _this.paused = !_this.paused;
            if(_this.paused && _this.tint) {
                _this.refresh();
            };
        }
        this.html.advance.onclick = function(e) {
            _this.paused = true;
            _this.process();
            _this.refresh();
        }
        this.html.clear.onclick = function(e) {
            _this.paused = true;
            for(let i1 = 0; i1 < _this.values.length; i1++) {
                _this.values[i1] = 0;
            }
            _this.history = [];
            _this.refresh();
        }
        this.html.save.onclick = function(e) {
            _this.formation = structuredClone(_this.values);
        }
        this.html.load.onclick = function(e) {
            _this.paused = true;
            _this.values = structuredClone(_this.formation);
            _this.history = [];
            _this.refresh();
        }
        this.html.tint.onclick = function(e) {
            if(_this.paused) {
                _this.refresh();
            }
        }
        this.html.afterimages.onclick = function(e) {
            if(_this.paused) {
                _this.refresh();
            }
        }
        this.html.execute.onclick = function(e) {
            _this.paused = true;
            _this.values = _this.interpret(_this.html.scripting.value);
            _this.history = [];
            _this.refresh();
        }
        this.html.change_size.onclick = function(e) {
            let value = prompt("enter one or two numbers for the size of the field. (how many cells there are in one row/column.)\n\nchanging the field size will clear the field and the save/load formation.") ?? "";
            value = value.split(",");
            value[1] ??= value[0];
            value = [Number(value[0]), Number(value[1])];
            let w = Number.isInteger(value[0]) && value[0] > 0 ? value[0] : _this.w;
            let h = Number.isInteger(value[1]) && value[1] > 0 ? value[1] : _this.h;
            if(w !== _this.w || h !== _this.h) {
                _this.paused = true;
                _this.values = [];
                for(let i1 = 0; i1 < w*h; i1++) {
                    _this.values.push(0);
                };
                _this.formation = structuredClone(_this.values);
                _this.history = [];
                _this.w = w;
                _this.h = h;
            }
        }
        this.html.noise.onclick = function(e) {
            let num = readnumber(_this.html.noise_level.value);
            if(num) {
                _this.paused = true;
                for(let i1 = 0; i1 < _this.values.length; i1++) {
                    if(Math.random() < num) {
                        _this.values[i1] = Number(!_this.values[i1]);
                    }
                }
                _this.history = [];
                _this.refresh();
            }
        }
        this.html.save_image.onclick = function(e) {
            savecanvas(_this.ctx.canvas, "cell toy " + filedate() + " " + _this.html.rules.value.trim().replaceAll("/", "[slash]").replaceAll("?", "'").replaceAll(":", "%") + ".png");
        }
        this.html.rules.onchange = function(e) {
            _this.update_rules();
            _this.refresh();
        }
        this.update_rules();
        this.refresh();
    }
    update_rules() {
    // reads the rules input and updates the this.birth and this.survive
    // objects.
    // - structure of birth and survive: {numbers, exceptions, every}.
    //   - every is the most important property, and usually the only relevant
    //     one. it's an array of 256 booleans, each index representing a
    //     different combination of living neighbors.
    //     - let's say birth.every[214] is true.
    //     - CellToy.int_bool(214) = [false, true, true, false, true, false,
    //       true, true]
    //     - each of those indexes represents one neighbor, and whether it's
    //       alive. it starts at the right neighbor, going clockwise.
    //     - so, the fact that birth.every[214] is true means... if right is
    //       dead, down-right is alive, down is alive, down-left is dead, left
    //       is alive, up-left is dead, up is alive, and up-right is alive,
    //       birth will happen.
    //     - such a high degree of precision sounds too obtuse to use, but it
    //       isn't, because i'm godlike like that.
    //   - numbers is an array of 9 booleans. it's what you'd expect. if
    //     survive.numbers is [false, false, true, true, false, false, false,
    //     false], that means before any exceptions were written, the user asked
    //     for only combinations with 2 or 3 living neighbors to allow survival.
    //   - exceptions is an array of objects representing exceptions after that.
    //     - sign: 1 means cells that match this exception should pass the rule.
    //       -1 means they should fail. 0 means whether it passed or failed
    //       should be inverted.
    //     - neighbors: the combination of neighbors it describes. 0 means dead,
    //       1 means living, -1 means ambiguous.
    //     - cycle
        let i0 = 0;
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let birth_text = this.html.rules.value.split("/");
        let survive_text = birth_text[1] ?? "";
        birth_text = birth_text[0];
        for(i0 = 0; i0 < 2; i0++) {
            let string = trimunspecial(i0 ? survive_text : birth_text);
            let numbers = [];
            let words = [];
            if(string) {
                let ranges = block_ranges(string, false, "(", ")");
                for(i1 = 1; i1 <= ranges.length; i1 += 2) {
                // for every parentheses block, replace all patches of whitespace
                // (with or without a comma before) with a comma. this way, it can
                // be broken up into words better.
                    let block = string_block(string, ranges, i1);
                    let offset = block.length;
                    block = trimunspecial(block.replaceAll(",", " ")).replaceAll(" ", ",");
                    string = string.slice(0, ranges[i1 - 1]) + block + string.slice(ranges[i1]);
                    offset = block.length - offset;
                    for(i2 = i1 + 1; i2 < ranges.length; i2++) {
                    // adjust the later ranges indexes, so it isn't thrown off
                    // by the decrease in the block's length
                        ranges[i2] += offset;
                    }
                }
                words = string.split(" ");
                let first = words[0];
                for(i1 = 0; i1 <= 8; i1++) {
                    if(first.includes(i1 + "")) {
                        first = first.replace(i1 + "", "");
                        numbers.push(true);
                    }
                    else {
                        numbers.push(false);
                    }
                }
                if(first) {
                // the first word had characters besides 0-8 integers. that
                // means this field probably always fails, (ex: "2 / " never
                // allows survival) but has an exception. it mistook that for
                // the number string, just because it's the first word.
                    numbers = [];
                    for(i1 = 0; i1 <= 8; i1++) {
                        numbers.push(false);
                    }
                }
                else {
                    words = words.slice(1);
                };
            }
            else {
                for(i1 = 0; i1 <= 8; i1++) {
                    numbers.push(false);
                }
            }
            // number interpretation done
            let every = [];
            for(i1 = 0; i1 < 256; i1++) {
                let temp = CellToy.int_bool(i1);
                let count = 0;
                for(i2 = 0; i2 < temp.length; i2++) {
                    if(temp[i2]) {
                        count++;
                    }
                }
                every.push(numbers[count]);
            }
            // basic every formation done
            let exceptions = [];
            for(i1 = 0; i1 < words.length; i1++) {
                let word = words[i1];
                let sign = word.startsWith("+") ? 1 : word.startsWith("-") ? -1 : 0;
                if(sign) {
                    word = word.slice(1);
                };
                let type = (
                    word.startsWith("and") ? "and" :
                    word.startsWith("or") ? "or" :
                    word.startsWith("!and") ? "!and" :
                    word.startsWith("!or") ? "!or" :
                    (word.startsWith("a") || word.startsWith("d")) ? "a/d" :
                    // put this last, so it doesn't mistake and for a/d.
                    ""
                );
                if(type === "a/d") {
                    let alive = word.startsWith("a");
                    word = word.slice(1);
                    let neighbors = [];
                    for(i2 = 0; i2 < 8; i2++) {
                        neighbors.push(Number(alive));
                    }
                    let cycle = 1;
                    let temp = word.indexOf(":");
                    if(temp !== -1) {
                        cycle = Number(word.slice(temp + ":".length));
                        cycle = (Number.isInteger(cycle) && (cycle === 0 || (cycle > 0 && !(8%cycle)))) ? cycle : 1;
                        word = word.slice(0, temp);
                    };
                    let index = 0;
                    while(word.length) {
                        if("0123456789".includes(word[0])) {
                            index = posmod(index + Number(word[0]), 8);
                            neighbors[index] = Number(!alive);
                            if(word.length >= 2 && word[1] === "?") {
                                neighbors[index] = -1;
                                word = word.slice(1);
                            };
                        };
                        word = word.slice(1);
                    }
                    exceptions.push({type, sign, neighbors, cycle});
                }
                else if(type) {
                    word = word.slice(type.length);
                    if(word.startsWith("(") && word.endsWith(")")) {
                        word = word.slice(1, -1).split(",");
                        let neighbors = [];
                        for(i2 = 0; i2 < 8; i2++) {
                            neighbors.push(false);
                        }
                        const directions = "r dr d dl l ul u ur".split(" ");
                        for(i2 = 0; i2 < word.length; i2++) {
                            let plus = 0;
                            while(word[i2].endsWith("+")) {
                                word[i2] = word[i2].slice(0, -1);
                                plus++;
                            }
                            let index = directions.indexOf(word[i2]);
                            if(index !== -1) {
                                neighbors[index] = true;
                                for(i3 = 1; i3 <= plus; i3++) {
                                    neighbors[posmod(index - i3, 8)] = true;
                                    neighbors[posmod(index + i3, 8)] = true;
                                }
                            }
                        }
                        exceptions.push({type, sign, neighbors});
                    };
                };
            }
            // exceptions done
            for(i1 = 0; i1 < exceptions.length; i1++) {
                let sign = exceptions[i1].sign;
                let type = exceptions[i1].type;
                let neighbors = structuredClone(exceptions[i1].neighbors);
                if(type === "a/d") {
                    for(i2 = 0; i2 < neighbors.length; i2++) {
                        neighbors[i2] = neighbors[i2] === 0 ? false : neighbors[i2] === 1 ? true : neighbors[i2];
                    }
                    let combos = [structuredClone(neighbors)];
                    for(i2 = 0; i2 < neighbors.length; i2++) {
                        if(neighbors[i2] === -1) {
                            combos = structuredClone(combos).concat(structuredClone(combos));
                            for(i3 = 0; i3 < combos.length; i3++) {
                                combos[i3][i2] = i3 >= combos.length/2;
                            }
                        }
                    }
                    // to account for ambiguity, multiply the number of
                    // combinations.
                    let indexes = [];
                    let cycle = exceptions[i1].cycle;
                    for(i2 = 0; i2 < combos.length; i2++) {
                        //console.log("=");
                        //console.log(structuredClone(combos[i2]));
                        let num = CellToy.bool_int(combos[i2]);
                        if(combos[i2].length !== 8 || combos[i2].includes(-1)) {
                            console.log("this shouldn't happen");
                        };
                        indexes.push(num);
                        if(cycle) {
                            for(i3 = 1; i3 < 8/cycle; i3++) {
                                let array = structuredClone(combos[i2].slice(i3*cycle)).concat( structuredClone(combos[i2].slice(0, i3*cycle)) );
                                num = CellToy.bool_int(array);
                                if(!indexes.includes(num)) {
                                    // if the combination is symmetrical, cycling could
                                    // create duplicates. that's especially bad if sign
                                    // is zero, since duplicates would negate the
                                    // original.
                                    indexes.push(num);
                                }
                            }
                        }
                    }
                    for(i2 = 0; i2 < indexes.length; i2++) {
                        every[ indexes[i2] ] = sign === -1 ? false : sign === 1 ? true : !every[ indexes[i2] ];
                    }
                }
                else {
                    for(i2 = 0; i2 < every.length; i2++) {
                        let array = CellToy.int_bool(i2);
                        if(
                            type === "and" ? array.every((element, index) => (neighbors[index] ? array[index] : true)) :
                            // every index that's true in neighbors is also true
                            // for the neighbors this every index represents.
                            type === "or" ? array.some((element, index) => (neighbors[index] && array[index])) :
                            // at least one index is true in both
                            type === "!and" ? !array.every((element, index) => (neighbors[index] ? array[index] : true)) :
                            type === "!or" ? !array.some((element, index) => (neighbors[index] && array[index])) :
                            // same thing, but it failed
                            false
                        ) {
                            every[ i2 ] = sign === -1 ? false : sign === 1 ? true : !every[ i2 ];
                        }
                    }
                }
            }
            this[i0 ? "survive" : "birth"] = {numbers, exceptions, every};
        }
    }
    exceptions_visual() {
        let rows = [];
        for(let i0 = 0; i0 < 2; i0++) {
            rows[4*i0] = i0 ? "survive" : "birth";
            let ref = this[ rows[4*i0] ];
            let top = "";
            let middle = "";
            let bottom = "";
            for(let i1 = 0; i1 < ref.every.length; i1++) {
                let count = 0;
                let array = CellToy.int_bool(i1);
                for(let i2 = 0; i2 < array.length; i2++) {
                    count += array[i2];
                }
                if(ref.every[i1] !== ref.numbers[count]) {
                    top += " " + (array[5] ? "o" : "x") + (array[6] ? "o" : "x") + (array[7] ? "o" : "x");
                    middle += " " + (array[4] ? "o" : "x") + " " + (array[0] ? "o" : "x");
                    bottom += " " + (array[3] ? "o" : "x") + (array[2] ? "o" : "x") + (array[1] ? "o" : "x");
                }
            }
            rows[4*i0 + 1] = top;
            rows[4*i0 + 2] = middle;
            rows[4*i0 + 3] = bottom;
        }
        return rows.join("\n");
    }
    static bool_int(array) {
        let int = 0;
        for(i1 = 0; i1 < array.length; i1++) {
            if(array[i1]) {
                int += 2**i1;
            }
        }
        return int;
    }
    static int_bool(int) {
        int = posmod(Math.floor(int), 256);
        let array = [];
        for(let i1 = 0; i1 < 8; i1++) {
            array.push(int%(2**(i1 + 1)) >= (2**i1));
        }
        return array;
    }
    get w() {
        return this._w;
    }
    set w(value) {
        if(Number.isInteger(value) && value > 0) {
            this._w = value;
            this.refresh();
        }
    }
    get h() {
        return this._h;
    }
    set h(value) {
        if(Number.isInteger(value) && value > 0) {
            this._h = value;
            this.refresh();
        }
    }
    get fps() {
        let value = Number(this.html.fps.value);
        return Number.isInteger(value) && value > 0 ? value : 12;
    }
    set fps(value) {
        if(Number.isInteger(value) && value > 0) {
            this.html.fps.value = value;
        }
    }
    get dead_color() {
        return this.html.color.dead.value;
    }
    set dead_color(value) {
        this.html.color.dead.value = value;
    }
    get alive_colors() {
        let array = this.html.color.alive.value.split("\n");
        for(let i1 = 0; i1 < array.length; i1++) {
            array[i1] = array[i1].trim();
            if(!array[i1]) {
                array.splice(i1, 1);
                i1--;
            }
        }
        return array.length ? array : ["black"];
    }
    set alive_colors(value) {
        this.html.color.alive.value = value.join("\n");
    }
    get afterimages() {
        return this.html.afterimages.checked;
    }
    set afterimages(value) {
        this.html.afterimages.checked = !!value;
    }
    get tint() {
        return this.html.tint.checked;
    }
    set tint(value) {
        this.html.tint.checked = !!value;
    }
    get birth_tint() {
        return this.html.birth_tint.value;
    }
    set birth_tint(value) {
        this.html.birth_tint.value = value;
    }
    get death_tint() {
        return this.html.death_tint.value;
    }
    set death_tint(value) {
        this.html.death_tint.value = value;
    }
    get grid_cell() {
        let value = Number(this.html.grid_cell.value);
        return (Number.isInteger(value) && value > 0) ? value : 1;
    }
    set grid_cell(value) {
        if(Number.isInteger(value) && value > 0) {
            this.html.grid_cell.value = value;
        }
    }
    get grid_border() {
        let value = Number(this.html.grid_border.value);
        return (Number.isInteger(value) && value >= 0) ? value : 1;
    }
    set grid_border(value) {
        if(Number.isInteger(value) && value >= 0) {
            this.html.grid_border.value = value;
        }
    }
    get grid_size() {
        return this.grid_cell + this.grid_border;
    }
    get grid_color() {
        return this.html.color.grid.value;
    }
    set grid_color(value) {
        this.html.color.grid.value = value;
    }
    get paused() {
        return this._paused;
    }
    set paused(value) {
        if(!!value === this.paused) {
            return;
        }
        this._paused = !!value;
        if(value) {
            clearInterval(this.interval);
            this.interval = null;
        }
        else {
            let _this = this;
            this.interval = setInterval(function() { _this.process() }, 1000/this.fps);
        };
        this.html.pause.innerHTML = value ? "play" : "pause";
    }
    interpret(script, values) {
    // interpreter for a scripting system that lets you place points with a lot
    // more precision. (also acts as a way of saving formations to text, sorta.)
    // - i make a microlanguage for like every project i make. it's just fun,
    //   and so so useful. perfection in versatility and precision.
    // - returns a new version of this.values, that has applied the described
    //   changes.
        values ??= this.values;
        let _values = structuredClone(values);
        //
        script = uncomment(script);
        script = script.split("\n");
        for(let i1 = 0; i1 < script.length; i1++) {
            if(!script[i1].trim()) {
                script.splice(i1, 1);
                i1--;
            }
        }
        // empty lines that have the wrong number of indents might disrupt
        // loop/mirror blocks.
        let x = 0;
        let y = 0;
        let w = this.w;
        let h = this.h;
        let mark_x = 0;
        let mark_y = 0;
        function readcoor(string, x_mirror, y_mirror) {
            let coor = trimunspecial(string).split(" ");
            if(coor.length === 1 && coor[0] === "random") {
                coor = [
                    Math.floor((Math.random() - .5)*w),
                    Math.floor((Math.random() - .5)*h)
                ];
            }
            else {
                for(let i1 = 0; i1 < 2; i1++) {
                    let num = readnumber(coor[i1] ?? "0") ?? 0;
                    coor[i1] = Number.isInteger(num) ? num : Math.trunc((num%1)*(!i1 ? w : h));
                }
            }
            if(x_mirror) {
                coor[0] *= -1;
            }
            if(y_mirror) {
                coor[1] *= -1;
            }
            return coor;
        }
        function subscript(script, index) {
            let _script = [];
            for(let i1 = index + 1; i1 < script.length && script[i1].startsWith("\t"); i1++) {
                _script.push(script[i1].slice("\t".length));
            }
            return _script;
        }
        function interpret(script, x_mirror, y_mirror) {
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            for(i1 = 0; i1 < script.length; i1++) {
                let line = script[i1].trimEnd();
                if(line === "center") {
                    line = "move to .5 .5";
                };
                //
                if(line.startsWith("move")) {
                    line = line.slice("move".length).trim();
                    let to = line.startsWith("to");
                    if(to) {
                        line = line.slice("to".length).trim();
                    };
                    if(line) {
                        let coor = readcoor(line);
                        if(to) {
                            coor[0] -= x;
                            coor[1] -= y;
                        };
                        x = posmod(x + (x_mirror ? -1 : 1)*coor[0], w);
                        y = posmod(y + (y_mirror ? -1 : 1)*coor[1], h);
                    };
                }
                else if(line.startsWith("birth") || line.startsWith("death")) {
                    let birth = line.startsWith("birth");
                    line = line.slice((birth ? "birth" : "death").length).trim();
                    let _w = 1;
                    let _h = 1;
                    let _x = x;
                    let _y = y;
                    let sign = [1, 1];
                    if(line) {
                        line = trimunspecial(line).split(" ");
                        line[1] ??= "1";
                        _w = Number(line[0]);
                        _h = Number(line[1]);
                        _w = Number.isInteger(_w) ? _w : 1;
                        _h = Number.isInteger(_h) ? _h : 1;
                        //
                        sign[0] *= Math.sign(_w)*(x_mirror ? -1 : 1);
                        sign[1] *= Math.sign(_h)*(y_mirror ? -1 : 1);
                        _w = Math.abs(_w);
                        _h = Math.abs(_h);
                        if(line.length > 2) {
                            let coor = readcoor(line.slice(2, 4).join(" "), x_mirror, y_mirror);
                            _x += coor[0];
                            _y += coor[1];
                        }
                    }
                    for(i2 = 0; i2 < _w; i2++) {
                        for(i3 = 0; i3 < _h; i3++) {
                            let __x = posmod(_x + sign[0]*i2, w);
                            let __y = posmod(_y + sign[1]*i3, h);
                            _values[__y*w + __x] = Number(birth);
                        }
                    }
                }
                else if(line === "mark") {
                    mark_x = x;
                    mark_y = y;
                }
                else if(line === "return") {
                    x = mark_x;
                    y = mark_y;
                }
                else if(line.startsWith("loop")) {
                    let num = Number(line.slice("loop".length).trim());
                    if(Number.isInteger(num) && num > 0) {
                        let _script = subscript(script, i1);
                        i1 += _script.length;
                        let _x = x;
                        let _y = y;
                        for(i2 = 0; i2 < num; i2++) {
                            interpret(_script, x_mirror, y_mirror);
                        }
                        x = _x;
                        y = _y;
                    }
                }
                else if(line.startsWith("mirror")) {
                    line = trimunspecial(line.slice("mirror".length)).split(" ");
                    if(line[0] === "x" || line[0] === "y" || line[0] === "xy") {
                        let _script = subscript(script, i1);
                        i1 += _script.length;
                        let _x = x;
                        let _y = y;
                        interpret(_script, x_mirror, y_mirror);
                        let coor = readcoor(line.slice(1).join(" "), x_mirror, y_mirror);
                        x = posmod(_x + coor[0], w);
                        y = posmod(_y + coor[1], h);
                        interpret(_script, invertboolean(line[0] === "x" || line[0] === "xy", x_mirror), invertboolean(line[0] === "y" || line[0] === "xy", y_mirror));
                        x = _x;
                        y = _y;
                    }
                }
            }
        }
        interpret(script);
        return _values;
    }
    advance(values) {
    // returns the advanced version of the inputted values. (as in, it processes
    // one frame of births/deaths.)
        values ??= this.values;
        let _values = [];
        let w = this.w;
        let h = this.h;
        const birth_allowed = this.html.birth_allowed.checked;
        const death_allowed = this.html.death_allowed.checked;
        for(let i1 = 0; i1 < values.length; i1++) {
            let x = i1%w;
            let y = Math.floor(i1/w);
            let index = 0;
            for(let i2 = 0; i2 < 8; i2++) {
                let _x = x + Number(posmod(i2 - 7, 8) < 3) - Number(posmod(i2 - 3, 8) < 3);
                let _y = y + Number(posmod(i2 - 1, 8) < 3) - Number(posmod(i2 - 5, 8) < 3);
                if(values[posmod(_y, h)*w + posmod(_x, w)]) {
                    index += 2**i2;
                };
            }
            // refer to the comments under get_rules for how birth/survive
            // indexes work.
            _values.push(
                values[i1]
                ?
                ((this.survive.every[index] || !death_allowed) ? values[i1] : 0)
                :
                ((this.birth.every[index] && birth_allowed) ? 1 : 0)
            );
            // - if it's alive, make it dead if it fails to survive.
            // - if it's dead, make it alive if there's a birth
        }
        let shuffle = 0;
        for(let i1 = 0; i1 < shuffle; i1++) {
            let index1 = Math.floor(Math.random()*_values.length);
            let index2 = Math.floor(Math.random()*_values.length);
            let temp = structuredClone(_values[index1]);
            _values[index1] = structuredClone(_values[index2]);
            _values[index2] = temp;
        }
        return _values;
    }
    process() {
    // advances the cells and refreshes.
        this.history.splice(0, 0, structuredClone(this.values));
        let temp = this.alive_colors.length - 1;
        if(this.history.length > temp) {
            this.history.splice(temp, this.history.length - temp);
        };
        this.values = this.advance();
        this.refresh();
    }
    refresh() {
    // refreshes, showing changes to the cells.
        let i0 = 0;
        let i1 = 0;
        let w = this.w;
        let h = this.h;
        let cells = [];
        // -1: dead in this.values and all of this.history
        // 0: alive in this.values
        // [positive integers]: alive in this.history[number - 1], but not
        // this.values or any lower this.history grids
        for(i1 = 0; i1 < w*h; i1++) {
            cells.push(this.values[i1] ? 0 : -1);
        }
        if(this.afterimages) {
            for(i0 = 0; i0 < this.history.length; i0++) {
                for(i1 = 0; i1 < w*h; i1++) {
                    if(cells[i1] === -1 && this.history[i0][i1]) {
                        cells[i1] = i0 + 1;
                    }
                }
            }
        }
        let grid_cell = this.grid_cell;
        let grid_border = this.grid_border;
        let grid_size = this.grid_size;
        let _w = grid_size*this.w + grid_border;
        let _h = grid_size*this.h + grid_border;
        this.html.canvas.width = _w;
        this.html.canvas.height = _h;
        this.ctx.fillStyle = this.grid_color;
        this.ctx.clearRect(0, 0, _w, _h);
        this.ctx.fillRect(0, 0, _w, _h);
        let coor = function(index) {
            let x = i1%w;
            let y = Math.floor(i1/w);
            return [
                grid_size*x + grid_border,
                grid_size*y + grid_border
            ];
        };
        let dead = this.dead_color;
        let alive = this.alive_colors;
        for(i1 = 0; i1 < cells.length; i1++) {
            this.ctx.fillStyle = cells[i1] === -1 ? dead : alive[ cells[i1] ];
            this.ctx.clearRect(...coor(i1), grid_cell, grid_cell);
            this.ctx.fillRect(...coor(i1), grid_cell, grid_cell);
        }
        if(this.paused && this.tint) {
        // birth/death tint
            let advance = this.advance();
            for(i1 = 0; i1 < advance.length; i1++) {
                let x = i1%w;
                let y = Math.floor(i1/w);
                if(advance[i1] && !this.values[i1]) {
                    this.ctx.fillStyle = this.birth_tint;
                    this.ctx.fillRect(...coor(i1), grid_cell, grid_cell);
                }
                else if(!advance[i1] && this.values[i1]) {
                    this.ctx.fillStyle = this.death_tint;
                    this.ctx.fillRect(...coor(i1), grid_cell, grid_cell);
                };
            }
        }
    }
}

function savecanvas(canvas, filename) {
// saves the given canvas as an image.
// - for some reason, saving canvases the normal way doesn't work anymore! at
//   least for me.
    filename ??= filedate() + ".png";
    let downloader = document.createElement("a");
    downloader.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    downloader.download = filename;
    downloader.click();
}

//

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
function easing(time, inorout, curve, overshoot/*[peak, time, inorout]*/, value1, value2) {
// - curve: string for which kind of curve it is.
//   - linear, sine, circ, square, cube, quart, quint
//   - most of those have alternate names, look at the altnames constant in
//     there
// - overshoot
//   - peak: the value it is when it peaks. (it goes from value1 to this to
//     value2.) (value1 + 1.25*(value2 - value1) by default)
//   - time: the time it peaks (that is, when it's value2) (.5 by default)
//   - by default, inorout is the same as the original inorout, but
//     inverted. (in becomes out, out becomes in. in/out and out/in are
//     unchanged)
//     - this is because generally, peak to value2 is in the opposite
//       direction as value1 to value2.
    time = Math.min(Math.max(0, time), 1);
    inorout = ["in", "out", "in/out", "out/in"].includes(inorout) ? inorout : "in";
    if(typeof curve !== "number" && !["linear", "sine", "circ", "square", "cube", "quart", "quint"].includes(curve)) {
        const altnames = {
            circ: ["circular", "circle"],
            sine: ["sin"],
            square: ["^2", "**2"],
            cube: ["^3", "**3", "cubic", "cubed"],
            quart: ["^4", "**4"],
            quint: ["^5", "**5"],
        };
        let temp = false;
        let i1 = 0;
        for(i1 in altnames) {
            if(altnames.hasOwnProperty(i1) && altnames[i1].includes(curve)) {
                temp = true;
                curve = i1;
            };
        }
        if(!temp) {
            curve = "sine";
        };
    }
    value1 = typeof value1 === "number" ? value1 : 0;
    value2 = typeof value2 === "number" ? value2 : 1;
    if(overshoot) {
        if(!Array.isArray(overshoot)) {
            overshoot = [];
        };
        let os = {
            peak: overshoot[0] ?? (value1 + 1.25*(value2 - value1)),
            time: overshoot[1] ?? .5,
            inorout: overshoot[2] ?? {
                in: "out",
                out: "in",
                "out/in": "out/in",
                "in/out": "in/out",
            }[inorout],
        };
        if(os.peak !== value2 && os.time !== 1) {
        // those might cause divide by zero errors, and the result is the
        // same as if it wasn't there
            if(time <= os.time) {
                time /= os.time;
                value2 = os.peak;
            }
            else {
                time = (time - os.time)/(1 - os.time);
                return easing(time, os.inorout, curve, false, os.peak, value2);
            }
        }
    }
    inorout = ["in", "out", "in/out", "out/in"].includes(inorout) ? inorout : "in";
    if(["in/out", "out/in"].includes(inorout)) {
        inorout = inorout.split("/");
        if(time < .5) {
            inorout = inorout[0];
            value2 = (value1 + value2)/2;
        }
        else {
            time -= .5;
            inorout = inorout[1];
            value1 = (value1 + value2)/2;
        }
        time *= 2;
    };
    if(curve === "sine") {
        inorout = {in: "out", out: "in"}[inorout];
    };
    if(inorout === "out") {
        time = 1 - time;
    };
    let endvalue = null;
    if(typeof curve === "number") {
        endvalue = time**curve;
    }
    else if(curve === "linear") {
        endvalue = time;
    }
    else if(curve === "sine") {
        endvalue = Math.sin(time*Math.PI/2);
    }
    else if(curve === "circ") {
        // a**2 + b**2 = c**2
        // time**2 + (1 - end)**2 = r**2
        // (1 - end)**2 = 1 - time**2
        // (1 - end) = Math.sqrt(1 - time**2)
        // end = 1 - Math.sqrt(1 - time**2)
        endvalue = 1 - Math.sqrt(1 - time**2);
    }
    else if(["square", "cube", "quart", "quint"].includes(curve)) {
        endvalue = time**( ["square", "cube", "quart", "quint"].indexOf(curve) + 2 );
    };
    if(inorout === "out") {
        endvalue = 1 - endvalue;
    };
    return value1 + endvalue*(value2 - value1);
}
function wave(place, wavetype, equil, crest, invert) {
// 0, .5, and 1 are equilibrium, .25 is crest, .75 is trough
// - except sawtooth.
    place = posmod(place, 1);
    if(!["sine", "circ", "square", "tri", "saw"].includes(wavetype)) {
        const altnames = {
            sine: ["sin"],
            circ: ["circular", "circle"],
            square: ["sq"],
            tri: ["triangle"],
            saw: ["sawtooth"],
        }
        let temp = false;
        let i1 = 0;
        for(i1 in altnames) {
            if(altnames.hasOwnProperty(i1) && altnames[i1].includes(wavetype)) {
                temp = true;
                wavetype = i1;
            };
        }
        if(!temp) {
            wavetype = "sine";
        };
    }
    equil ??= 0;
    crest ??= 1;
    let amp = (crest - equil)*(invert ? -1 : 1);
    //*
    let endvalue = (
        wavetype === "sine" ? Math.sin(2*Math.PI*place) :
        wavetype === "circ" ? (
            place < .5
            ?
            Math.sqrt(1 - (4*Math.abs(.25 - place))**2)
            :
            -Math.sqrt(1 - (4*Math.abs(.75 - place))**2)
        ) :
        wavetype === "square" ? (place < .5 ? 1 : -1) :
        wavetype === "tri" ? (1 - Math.abs(4*((place + .25)%1) - 2)) :
        wavetype === "saw" ? 2*(place - .5) :
        0
    );
    //*/
    /*
    let endvalue = 0;
    if(wavetype === "sine") {
        endvalue = Math.sin(2*Math.PI*place);
    }
    else if(wavetype === "circ") {
        endvalue = (
            place < .5
            ?
            Math.sqrt(1 - (4*Math.abs(.25 - place))**2)
            :
            -Math.sqrt(1 - (4*Math.abs(.75 - place))**2)
        );
    }
    else if(wavetype === "square") {
        endvalue = (place < .5 ? 1 : -1);
    }
    else if(wavetype === "triangle") {
        endvalue = (1 - Math.abs(4*((place + .25)%1) - 2));
    }
    else if(wavetype === "saw") {
        endvalue = 2*(place - .5);
    };
    //*/
    /*
    if(["sine", "circ", "triangle"].includes(wavetype)) {
        easing((time + .75)%1, "in/out", (wavetype === "triangle" ? "linear" : wavetype), [crest], trough, trough)
    }
    else if(wavetype === "square") {
        return
        easing((time + .75)%1, "in/out", "sine", [crest], trough, trough)
    }
    screw this, it'd be slower
    */
    return equil + amp*endvalue;
}
function copy(ctx, x, y, w, h, background) {
// getImageData and putImageData have the small gigantic flaw of fully
// replacing what's there without factoring in transparency at all. this and
// paste are an alternative that does.
// - background: if this is a color, (whether a string or an array) any
//   pixels of that color exactly will be saved with zero opacity.
    let i1 = 0;
    let i2 = 0;
    x = Math.floor(x);
    y = Math.floor(y);
    w = Math.floor(w);
    h = Math.floor(h);
    if(w === 0 || h === 0) {
        return {w: 0, h: 0};
    };
    if(w < 0) {
        x += w;
        w *= -1;
    };
    if(h < 0) {
        y += h;
        h *= -1;
    };
    if(x < 0) {
        w += x;
        x = 0;
    };
    if(y < 0) {
        h += y;
        y = 0;
    };
    let canvas_w = ctx.canvas.width;
    let canvas_h = ctx.canvas.height;
    if(x + w >= canvas_w) {
        w = canvas_w - x;
    };
    if(y + h >= canvas_h) {
        h = canvas_h - y;
    };
    if(typeof background === "string") {
        background = Color.rgb(ctx, background);
    };
    if(Array.isArray(background) && background.length === 3) {
        background[3] = 255;
    };
    background = (
        Array.isArray(background) && background.length === 4
        ?
        new Uint8ClampedArray(background)
        :
        null
    );
    // it fails if i don't do this. if i had to guess, special
    // "unsigned" "clamped" numbers don't count as the same as their
    // normal counterparts.
    let copydata = {w, h};
    let imagedata = ctx.getImageData(x, y, w, h);
    for(i1 = 0; i1 < imagedata.data.length; i1 += 4) {
        let color = imagedata.data.slice(i1, i1 + 4);
        if(compareobject(color, background)) {
            color[3] = 0;
        };
        copydata[Math.round(i1/4)] = new Uint8ClampedArray(color);
        // using this class should save space or prevent invalids or
        // something. probably.
    }
    return copydata;
};
function paste(ctx, x, y, copydata) {
// copydata: data returned by copy().
    let i1 = 0;
    let i2 = 0;
    let i3 = 0;
    let styletemp = ctx.fillStyle;
    let imagedata = ctx.getImageData(x, y, copydata.w, copydata.h);
    for(i1 = 0; i1 < copydata.w; i1++) {
        for(i2 = 0; i2 < copydata.h; i2++) {
            let index = i2*copydata.w + i1;
            let color = new Uint8ClampedArray(copydata[index]);
            if(color[3] !== 0) {
                if(color[3] !== 255) {
                    let under = imagedata.data.slice(index*4, (index + 1)*4);
                    for(i3 = 0; i3 < 3; i3++) {
                        const temp = under[i3] + Math.round((color[i3] - under[i3])*color[3]/255);
                        console.log(under[i3] - temp);
                        color[i3] = temp;
                        //rgb = rgb1 + (rgb2 - rgb1)*alpha2;
                    }
                    color[3] = 255 - ((255 - under[3]) * (255 - color[3])/255);
                    //alpha = 255 - ((255 - color1) * (255 - color2)/255);
                };
                ctx.fillStyle = "rgba(" + color.slice(0, 3) + "," + color[3]/255 + ")";
                ctx.clearRect(x + i1, y + i2, 1, 1);
                ctx.fillRect(x + i1, y + i2, 1, 1);
            };
        }
    }
    ctx.fillStyle = styletemp;
}
function linespecial(code, x1, y1, x2, y2, center) {
/*
linespecial(ctx, x1, y1, x2, y2, center)
linespecial(function(x, y, progress) {
    //
}, x1, y1, x2, y2, center)
//*/
// draws a line or runs a function on a line. it's like nonaaline, except it
// doesn't suck as bad. it tries to make it as symmetrical as possible.
// - code: function you want to run for each coordinate. the only arguments
//   should be x, y, and progress. (ie if the point is at the beginning or
//   end of the line. a 0 to 1 number.)
//   - if this is a canvas context, instead it'll draw a line one pixel
//     wide, using the strokeStyle.
//   - if this is null, it'll just return the points array.
// - center: a coordinate array. if it has to choose between two pixels,
//   it'll choose the one further from this.
    let i1 = 0;
    let i2 = 0;
    center ??= [0, 0];
    center[0] = Math.floor(center[0]);
    center[1] = Math.floor(center[1]);
    const SER = SL.start_end_rounding(x1, y1, x2, y2, center);
    x1 = SER[0];
    y1 = SER[1];
    x2 = SER[2];
    y2 = SER[3];
    let points = [];
    // list of coordinates to iterate over in order to draw a line or whatever you're doing
    if(x1 === x2 && y1 === y2) {
        points[0] = [x1, y1];
    }
    else if(x1 === x2) {
        const sign = Math.sign(y2 - y1);
        for(i1 = y1; Math.sign(y2 - i1) === sign || i1 === y2; i1 += sign) {
            points[points.length] = [x1, i1];
        }
    }
    else if(y1 === y2) {
        const sign = Math.sign(x2 - x1);
        for(i1 = x1; Math.sign(x2 - i1) === sign || i1 === x2; i1 += sign) {
            points[points.length] = [i1, y1];
        }
    }
    else {
        let temp = [
            Math.abs(x1 - x2) + 1,
            Math.abs(y1 - y2) + 1
        ];
        const axisA = Number(temp[1] > temp[0]);
        // longer axis (0 means x, 1 means y)
        const axisB = Number(!axisA);
        // shorter axis
        const dim = {
            0: temp[0],
            1: temp[1],
            get a() {
                return this[axisA];
            },
            get b() {
                return this[axisB];
            },
        };
        let linenum = [];
        // an array of segment lengths to create the line. (for example, an
        // 8 w 3 y line would be [3, 2, 3]) used to create the points.
        if(dim.a%dim.b === 0) {
        // avoids divide by zero errors, saves time
            let segment = Math.round(dim.a/dim.b);
            for(i1 = 0; i1 < dim.b; i1++) {
                linenum[i1] = segment;
            };
        }
        else {
            function bleah(dimA, dimB) {
            // tries to make linenum arrays like [4, 3, 4, 3, 4] or [2, 2,
            // 1, 2, 2].
                let i1 = 0;
                let i2 = 0;
                if(
                    dimA <= 0
                    ||
                    !Number.isInteger(dimA)
                    ||
                    dimB <= 0
                    ||
                    !Number.isInteger(dimB)
                ) {
                    console.log("invalid input.");
                    return;
                };
                if(dimB > dimA) {
                    const temp = numA;
                    numA = numB;
                    numB = temp;
                }
                let num1 = dimA%dimB;
                let num2 = dimB - num1;
                let value1 = Math.floor(dimA/dimB) + 1;
                let value2 = value1 - 1;
                if(num1 === num2) {
                    let array = [];
                    for(i1 = 0; i1 < num1; i1++) {
                        array[array.length] = value1;
                        array[array.length] = value2;
                    };
                    return array;
                }
                else if(num2 > num1) {
                    let temp = num1;
                    num1 = num2;
                    num2 = temp;
                    temp = value1;
                    value1 = value2;
                    value2 = temp;
                };
                // there's two lengths, 1 and 2. 1 is whichever there will
                // be more of. num1 and value1 are how many there will be of
                // length 1 and how long it is, num2 and value2 are the same
                // for length 2.
                let quotient = Math.floor(num1/(num2 + 1));
                // how many num1s there should be between num2s.
                let remainder = num1%(num2 + 1);
                // how many times there should be one more num1.
                let array = [];
                for(i1 = 0; i1 <= num2; i1++) {
                    for(i2 = 0; i2 < quotient + !!remainder; i2++) {
                        array[array.length] = value1;
                    }
                    if(remainder) {
                        remainder--;
                    };
                    if(i1 !== num2) {
                        array[array.length] = value2;
                    }
                }
                return array;
            };
            const gcf = mathgcf([dim.a, dim.b], true);
            if(gcf !== 1) {
                let temp = bleah(dim.a/gcf, dim.b/gcf);
                for(i1 = 0; i1 < gcf; i1++) {
                    linenum = linenum.concat(temp);
                };
            }
            else {
                linenum = bleah(dim.a, dim.b);
            }
        }
        //console.log("(" + dim[0] + ", " + dim[1] + ") linenum: " + linenum);
        temp = 0;
        for(i1 = 0; i1 < linenum.length; i1++) {
            temp += linenum[i1];
        }
        if(temp !== dim.a) {
            console.log("this shouldn't happen");
        };
        // linenum is complete, time to make the points.
        let coor = [x1, y1];
        let sign = {
            0: Math.sign(x2 - x1),
            1: Math.sign(y2 - y1),
            get a() {
                return this[axisA];
            },
            get b() {
                return this[axisB];
            },
        };
        for(i1 = 0; i1 < linenum.length; i1++) {
            for(i2 = 0; i2 < linenum[i1]; i2++) {
                points[points.length] = structuredClone(coor);
                coor[axisA] += sign.a;
            }
            coor[axisB] += sign.b;
        }
        coor[axisA] -= sign.a;
        coor[axisB] -= sign.b;
        const diff = [
            Math.abs(coor[0] - x2),
            Math.abs(coor[1] - y2)
        ];
        if(diff[0] || diff[1]) {
            console.log("difference: " + Math.hypot(...diff));
        };
        function inverse(x, y) {
            const midpoint = [
                (x1 + x2)/2,
                (y1 + y2)/2
            ];
            return [
                Math.round(-1*(x - midpoint[0]) + midpoint[0]),
                Math.round(-1*(y - midpoint[1]) + midpoint[1])
            ];
        };
        let _points = [];
        for(i1 = points.length - 1; i1 >= 0; i1--) {
            _points[_points.length] = inverse(...points[i1]);
        };
        // this should be the same thing but flipped 180.
        for(i1 = 0; i1 < points.length; i1++) {
        // compare each point's coordinate b to the inverse version's
        // coordinate b, and redefine the coordinate b accordingly.
        // - if the midpoint is an integer, use that.
        // - otherwise, choose whichever is further from the center.
        // - and if both distances are equal, choose whichever is lower.
            if(points[i1][axisA] !== _points[i1][axisA]) {
                console.log("this shouldn't happen: " + (points[i1][axisA] - _points[i1][axisA]));
            };
            let b = [
                points[i1][axisB],
                _points[i1][axisB]
            ];
            let diff = Math.abs(b[0] - b[1]);
            if(diff === 0) {
            }
            else if(diff%2 === 0) {
                //console.log("benign error. (" + dim.a + " x " + dim.b + ")");
                points[i1][axisB] = Math.round((b[0] + b[1])/2);
            }
            else {
                if(diff >= 2) {
                    //console.log("benign error. (" + dim.a + " x " + dim.b + ")");
                    b = [
                        Math.floor((b[0] + b[1])/2),
                        Math.ceil((b[0] + b[1])/2)
                    ];
                };
                let dists = [
                    Math.abs(center[axisB] - b[0]),
                    Math.abs(center[axisB] - b[1])
                ];
                points[i1][axisB] = (
                    dists[0] > dists[1]
                    ?
                    b[0]
                    :
                    (
                        dists[1] > dists[0]
                        ?
                        b[1]
                        :
                        Math.min(...b)
                    )
                );
            }
        };
    }
    // points array is done.
    if(code instanceof CanvasRenderingContext2D) {
        let styletemp = code.fillStyle;
        code.fillStyle = code.strokeStyle;
        for(i1 = 0; i1 < points.length; i1++) {
            code.fillRect(...points[i1], 1, 1);
        }
        code.fillStyle = styletemp;
    }
    else if(code === null) {
        return points;
    }
    else {
        for(i1 = 0; i1 < points.length; i1++) {
            code(...points[i1], i1/(points.length - 1));
        }
    }
};
let SL = {
// "special line". pseudoclass for an endless lines that use linespecial's
// algorithm.
// =
// structure:
// - x, y, w, h: the boundaries of the linespecial. w and h are always
//   positive, and x and y are always the up-left corner.
// - values: numbers used to check where a point is relative to the line.
//   - indexes are axisA - line[axisA] (longer dimension)
//   - values are axisB - line[axisB] (shorter dimension)
//   - subtract line x/y from a point, remainder by w/h
//   - if the point's axisB matches values[axisA], it's on the line.
// - points are checked through this process:
//   - subtract line.x and line.y
//   - create a grid of sorts with the w and h
//     - divide by them to see if it's even on a sector the line passes
//       through
//     - if it is, posmod by w and h and compare point[axisB] to
//       line.values[ point[axisA] ].
    start_end_rounding: function(x1, y1, x2, y2, center) {
    // used in linespecial. it's here to avoid DRY.
        x1 = Math.round(x1*2)/2;
        y1 = Math.round(y1*2)/2;
        x2 = Math.round(x2*2)/2;
        y2 = Math.round(y2*2)/2;
        // round to the nearest .5
        for(i1 = 0; i1 < 4; i1++) {
        // for .5s, round to whatever integer is closer to the other end of the
        // line. (this way, where the pixel is will depend on the direction of
        // the line, but it'll always use the corner you indicated.)
        // - or if they line up, move further from the center.
        //   - this code used to be only four lines before i accounted for that.
            let num = [x1, y1, x2, y2][i1];
            if(!Number.isInteger(num)) {
            // putting this in a conditional saves just a little bit of trouble.
                let temp = Math.sign([x2, y2, x1, y1][i1] - num);
                temp = temp ? temp : Math.sign(num - center[i1%2]);
                // sign that brings it closer to the other end, or further from the
                // center.
                num = Math[temp === 1 ? "ceil" : "floor"](num);
                if(i1 === 0) {
                    x1 = num;
                }
                else if(i1 === 1) {
                    y1 = num;
                }
                else if(i1 === 2) {
                    x2 = num;
                }
                else if(i1 === 3) {
                    y2 = num;
                };
            }
        }
        return [x1, y1, x2, y2];
    },
    new: function(x1, y1, x2, y2, center) {
        let i1 = 0;
        let line = {};
        let array = [];
        linespecial(function(x, y, progress) { array[array.length] = [x, y] }, x1, y1, x2, y2, center);
        let temp = [
            array[0],
            array[array.length - 1]
        ];
        line.x = Math.min(temp[0][0], temp[1][0]);
        line.y = Math.min(temp[0][1], temp[1][1]);
        line.w = Math.max(temp[0][0], temp[1][0]) - line.x;
        line.h = Math.max(temp[0][1], temp[1][1]) - line.y;
        // guarantee positive dimensions
        const axisA = Number(line.h > line.w);
        const axisB = (axisA + 1)%2;
        const dimA = line["wh"[axisA]];
        const coorA = line["xy"[axisA]];
        const coorB = line["xy"[axisB]];
        line.values = [];
        for(i1 = 0; i1 < dimA; i1++) {
            line.values[i1] = null;
        }
        for(i1 = 0; i1 < array.length; i1++) {
            let temp = array[i1][axisA] - coorA;
            line.values[temp] = array[i1][axisB] - coorB;
        }
        // subtract coorA/B so it starts at zero
        return line;
    },
    A_to_B: function(_this, coorA) {
    // input an coorA, and you get a value, which is axisB. coorB minus this
    // is the sign.
        const axisA = Number(_this.h > _this.w);
        const axisB = (axisA + 1)%2;
        const dimA = _this["wh"[axisA]];
        coorA -= _this["xy"[axisA]];
        // relative to x/y
        let value = _this["xy"[axisB]] + _this.values[ posmod(coorA, dimA) ];
        let temp = _this.values[ _this.values.length - 1 ] - _this.values[0];
        // dimB, except made the right positivity/negativity
        temp *= Math.floor(coorA/dimA);
        // where it is on the "grid", how many dimBs to add
        value += temp;
        return value;
    },
    check: function(_this, ref_x, ref_y, x, y, w, h) {
    // returns:
    // - 0 if x/y is on the line
    // - 1 if x/y is on the same side as ref_x/ref_y
    // - -1 if it's on the opposite
    // - returns null if ref_x/ref_y is on the line or the line's w and h are 0.
    // - w, h: optional. this will make it modify an entire rectangle of
    //   values and return that.
    //   - specifically an array of 0/1/-1s. w is how long one row is. x and y
    //     are the coordinates the top-left corner represents.
        let i1 = 0;
        let i2 = 0;
        const no_data = !w || !h;
        w ??= 1;
        h ??= 1;
        let data = [];
        for(i1 = 0; i1 < w*h; i1++) {
            data[i1] = null;
        };
        const _x = x;
        const _y = y;
        // top left corner (so that x and y's values can change)
        let ref_side = null;
        if(!_this.w || !_this.h) {
            // single point, or vertical/horizontal line
            if(_this.w || _this.h) {
                ref_side = Math.sign(
                    _this.h
                    ?
                    ref_x - _this.x
                    :
                    ref_y - _this.y
                );
            }
            if((!_this.w && !_this.h) || ref_side === 0) {
                // single point, or ref_x/ref_y is on the line
                return null;
            };
            for(i1 = 0; i1 < data.length; i1++) {
                x = _x + i1%w;
                y = _y + Math.floor(i1/w);
                data[i1] = ref_side*Math.sign(
                    _this.h
                    ?
                    x - _this.x
                    // vertical
                    :
                    y - _this.y
                    // horizontal
                );
            }
        }
        else {
            const axisA = Number(_this.h > _this.w);
            const axisB = (axisA + 1)%2;
            const rectA = axisA ? h : w;
            // longer axis, (or x) shorter axis
            ref_side = Math.sign((axisB ? ref_y : ref_x) - SL.A_to_B(_this, axisA ? ref_y : ref_x));
            if(ref_side === 0) {
                return null;
            }
            let values = [];
            for(i1 = 0; i1 < rectA; i1++) {
                values[i1] = SL.A_to_B(_this, (axisA ? _y : _x) + i1);
                // the conditional thing adds the rectangle's x/y
            };
            for(i1 = 0; i1 < data.length; i1++) {
                let coor = [
                    i1%w,
                    Math.floor(i1/w)
                ];
                data[i1] = ref_side*Math.sign([_x, _y][axisB] + coor[axisB] - values[ coor[axisA] ]);
            }
        }
        return (
            no_data
            ?
            data[0]
            :
            data
        );
    },
};
function rotate(points, axis, angle, center) {
// rotates one 3d point or an array of 3d points.
// - axis: "xy", "xz", "yz", or a 3d angle.
// - angle: how much to rotate by, in radians.
    let i1 = 0;
    center = (center && Array.isArray(center) && center.length >= 3 && (center[0] || center[1] || center[2])) ? center : null;
    const one = typeof points[0] === "number" && typeof points[1] === "number" && typeof points[2] === "number";
    let _points = one ? [structuredClone(points)] : structuredClone(points);
    // should be a new array. editing the input would be bad, because object
    // reference.
    if(typeof angle !== "number" || isNaN(angle) || angle === Infinity || angle === -Infinity) {
        console.log("invalid angle: " + angle);
    };
    angle = posmod(angle, 2*Math.PI);
    //
    if(center) {
        for(i1 = 0; i1 < _points.length; i1++) {
            _points[i1] = Points.subtract(_points[i1], center);
        }
    };
    //
    if(typeof axis === "string" && axis.length === 2) {
        axis1 = "xyz".indexOf(axis[0]);
        axis2 = "xyz".indexOf(axis[1]);
        if(axis1 === -1 || axis2 === -1) {
            console.log("invalid axis: " + axis);
            return;
        };
        let cos = [1, 0, -1, 0][angle/(Math.PI/2)] ?? Math.cos(angle);
        let sin = [0, 1, 0, -1][angle/(Math.PI/2)] ?? Math.sin(angle);
        for(i1 = 0; i1 < _points.length; i1++) {
            let coor1 = _points[i1][axis1];
            let coor2 = _points[i1][axis2];
            _points[i1][axis1] = coor1*cos - coor2*sin;
            _points[i1][axis2] = coor1*sin + coor2*cos;
        }
        // imaginary number style of rotation.
        // - [x, y] -> x + y*i
        // - angle -> cos(angle) + sin(angle)*i
        // - (x + y*i)*(cos + sin*i)
        // - i^2 = -1, so...
        // - (x*cos - y*sin) + (x*sin + y*cos)*i
        // - convert that back to coordinates.
    }
    else if(Array.isArray(angle) && typeof angle[0] === "number" && typeof angle[1] === "number") {
        let quat = Quat.new(axis, angle);
        _points = _points.length === 1 ? [Quat.apply(quat, _points[0])] : Quat.orient(quat, _points);
    };
    //
    if(center) {
        for(i1 = 0; i1 < _points.length; i1++) {
            _points[i1] = Points.add(_points[i1], center);
        }
    };
    //
    return one ? _points[0] : _points;
}
function get2dangle(x, y, shush) {
    if(x === 0) {
        if(y > 0) {
            return Math.PI/2;
        }
        else if(y < 0) {
            return 3*Math.PI/2;
        }
        else if(y === 0) {
            if(shush) {
                return null;
            }
            else {
                console.log("invalid get2dangle input: " + [x, y]);
                return 0;
            };
        }
        else {
            if(shush) {
                return null;
            }
            else {
                console.log("something went wrong with get2dangle.");
                return 0;
            };
        };
    }
    else {
        let returnangle = Math.atan(y/x);
        if(x < 0) {
            returnangle += Math.PI;
        };
        // double negatives make inverse tan screw up, etc
        return posmod(returnangle, 2*Math.PI);
    };
}
class Animator {
// a class that creates an animation player.
// structure:
// - name
// - ctx: canvas the animation is displayed on. element id is name +
//   "_canvas".
// - frames: array of ImageDatas. it animates by using putImageData with
//   this. add to this by using .clear to clear the canvas, applying edits,
//   and using .set to put it in .frames.
// - background: color to use when clearing the canvas.
// - a few getters/setters
// - ui: object describing what buttons/inputs to create. the property
//   name is the type/name.
//   - fps (frames per second, number input)
//   - play (button)
//   - loop (checkbox)
//   - pingpong (checkbox, makes it go back and forth)
//   - sheet (hideable canvas of all the frames. update it with
//     .updatesheet.)
//     - hidden by default.
//     - cols: number of columns.
//   - "button_" + whatever: extra button
//   -
//   - save: buttons that save images of the canvas or the spritesheet.
//     - no_frame, no_sheet: by default, buttons for both the frame and the
//       sheet are created.
//     - prefix, name, suffix: the saved file name will be prefix + name +
//       suffix. the reason i bother splitting it up is because if name is
//       omitted, it defaults to filedate().
//   =
//   - properties of properties:
//     - br: adds a linebreak before it. (or multiple, if the value is a
//       number instead of a boolean.)
//     - space: adds a space before it.
//     - onclick: function you want run when it's clicked
//     - text: text you want it to use. (by default, it'll just use the
//       property name.)
//   - the html id will be .name + "_" + the property name of the html
//     element. so fps would be "anim_fps" or whatever.
//     - except for "button_". it'll omit the beginning of that.
//   - null is treated the same as an empty object.
// - fps, looping: getters/setters connected to the html elements if those
//   exist, primitives if not.
    /*
    new Animator(
        "name",
        {
            fps: {
                br: true,
            },
            play: {
                space: true,
            },
            loop: {
                br: true,
            },
        },
        div, fps, background, w, h
    );
    */
    constructor(name, ui, div, fps, background, w, h) {
        let i1 = 0;
        if(!div) {
            document.write(`<div id="` + name + `_div"></div>`);
            div = document.getElementById(name + `_div`);
        };
        if(!Number.isInteger(fps) || fps <= 0) {
            fps = 24;
        };
        ui ??= structuredClone(Animator.default_ui);
        w ??= 256;
        h ??= 256;
        background ??= "black";
        this.name = name;
        this.div = div;
        this.defaultfps = fps;
        this.background = background;
        let temp = name + `_canvas`;
        let string = ``;
        string += `<canvas id="` + temp + `" name="` + temp + `" width=` + w + ` height=` + h + `></canvas>`;
        for(i1 in ui) {
            if(ui.hasOwnProperty(i1)) {
                ui[i1] ??= {};
                let obj = ui[i1];
                const text = (
                    obj.hasOwnProperty("text") ? obj.text :
                    i1.startsWith("button_") ? i1.slice("button_".length) :
                    i1
                );
                if(obj.hasOwnProperty("br")) {
                    if(Number.isInteger(obj.br) && obj.br >= 0) {
                        string += `<br>`.repeat(obj.br);
                    }
                    else if(obj.br) {
                        string += `<br>`;
                    };
                };
                if(obj.hasOwnProperty("space") && obj.space) {
                    string += ` `;
                };
                if(i1 === "fps") {
                    string += `<label>` + text + `: <input type="number" id="` + name + `_fps" value=` + fps + `>`;
                }
                else if(i1 === "play") {
                    string += `<button id="` + name + `_play">` + text + `</button></label>`;
                }
                else if(i1 === "loop") {
                    string += `<label>` + text + `: <input type="checkbox" id="` + name + `_loop"></label>`;
                }
                else if(i1 === "pingpong") {
                    string += `<label>` + text + `: <input type="checkbox" id="` + name + `_pingpong"></label>`;
                }
                else if(i1 === "sheet") {
                    string += `<button id="` + name + `_hidesheet">show sheet</button></label>`;
                    string += `<br><canvas id="` + name + `_sheet" name="` + temp + `" width=` + w + ` height=` + h + ` hidden></canvas>`;
                }
                else if(i1 === "save") {
                    let frame = !("no_frame" in obj) || !obj.no_frame;
                    let sheet = (!("no_sheet" in obj) || !obj.no_sheet) && "sheet" in ui;
                    string += (
                        (frame ? `<button id="` + name + `_save_frame">save frame</button>` : ``)
                        +
                        (frame && sheet ? ` ` : ``)
                        +
                        (sheet ? `<button id="` + name + `_save_sheet">save sheet</button>` : ``)
                    );
                }
                else if(i1.startsWith("button_")) {
                    string += `<button id="` + name + `_` + i1.slice("button_".length) + `">` + text + `</button>`;
                }
                else {
                    console.log("invalid ui property name.");
                };
            }
        }
        div.innerHTML = string;
        this.ctx = document.getElementById(temp).getContext("2d");
        this.ctx.fillStyle = background;
        this.ctx.fillRect(0, 0, w, h);
        this.viewer = {
            x: this.w/2,
            y: this.h/2,
            z: this.w/2,
            ratio: this.w/60,
            // ratio = pixels/degrees, screen_pixels = 60*degrees
            // if ratio === screen_pixels/60
            // screen_pixels = 60*screen_pixels/60
            offset: {
                x: 0,
                y: 0,
                z: 0,
            },
            lamp: {
            // USE .single === true IF THERE'S ONLY ONE LAMP.
                x: this.w,
                y: 0*this.h,
                z: -this.w,
                brightness: 1,
                baselightlevel: -1,
                single: true,
            },
            // baselightlevel
            // until i figure out how to convert colors to rgb, colors should be an
            // array.
        };
        // viewer is kind of a mess and should really be a class. don't try
        // too hard to make sense of this.
        this.frames = [];
        this._frame = 0;
        this._playing = false;
        this.interval = null;
        if(ui.hasOwnProperty("fps")) {
            Object.defineProperty(this, "fps", {
                get() {
                    let temp = Number(document.getElementById(this.name + `_fps`).value);
                    if(!Number.isInteger(temp) || temp <= 0) {
                        temp = this.defaultfps;
                        document.getElementById(this.name + `_fps`).value = temp;
                    };
                    return temp;
                },
                set(value) {
                    let temp = Number(value);
                    if(!Number.isInteger(temp) || temp <= 0) {
                        temp = this.defaultfps;
                    };
                    document.getElementById(this.name + `_fps`).value = temp;
                },
            })
        }
        else {
            this.fps = fps;
        };
        for(i1 = 0; i1 < 2; i1++) {
            let type = ["loop", "pingpong"][i1];
            let propertyname = ["looping", "pingpong"][i1]
            if(ui.hasOwnProperty(type)) {
                Object.defineProperty(this, propertyname, {
                    get() {
                        return document.getElementById(this.name + `_` + type).checked;
                    },
                    set(value) {
                        document.getElementById(this.name + `_` + type).checked = !!value;
                    },
                })
            }
            else {
                this[propertyname] = false;
            };
        }
        // define fps, loop, and pingpong as a getter/setter if there's an
        // html element, and a primitive if it's not.
        this.reverse = false;
        // boolean for whether it's playing backwards. necessary for
        // pingpong.
        let _this = this;
        for(i1 in ui) {
            if(ui.hasOwnProperty(i1) && ui[i1]) {
            // add event listeners
                if(i1 === "play") {
                    document.getElementById(name + `_` + i1).onclick = function() { _this.playpause(_this) };
                }
                else if(i1 === "pingpong") {
                    document.getElementById(name + `_` + i1).onclick = function() { _this.reverse = false };
                    // keeps reverse from lingering outside of pingpong.
                }
                else if(i1 === "sheet") {
                    let ref = document.getElementById(_this.name + `_` + i1);
                    this.sheet = ref.getContext("2d");
                    this.sheet_cols = ui[i1].cols ?? 0;
                    document.getElementById(name + `_hidesheet`).onclick = function() {
                        ref.hidden = !ref.hidden;
                        document.getElementById(_this.name + `_hidesheet`).innerHTML = (ref.hidden ? "show" : "hide") + " sheet";
                    };
                    this.updatesheet();
                }
                else if(i1 === "save") {
                    let _name = (ui[i1].prefix ?? "") + (ui[i1].name ?? filedate()) + (ui[i1].suffix ?? "") + ".png";
                    if(!("no_frame" in ui[i1]) || !ui[i1].no_frame) {
                        document.getElementById(name + `_` + i1 + `_frame`).onclick = function() { savecanvas(_this.ctx.canvas, _name) };
                    };
                    if((!("no_sheet" in ui[i1]) || !ui[i1].no_sheet) && "sheet" in ui) {
                        let sheet = document.getElementById(_this.name + `_sheet`);
                        document.getElementById(name + `_` + i1 + `_sheet`).onclick = function() { savecanvas(sheet, _name) };
                    };
                }
                else if(ui[i1].hasOwnProperty("onclick")) {
                    let id = name + "_" + (
                        i1.startsWith("button_")
                        ?
                        i1.slice("button_".length)
                        :
                        i1
                    );
                    document.getElementById(id).onclick = ui[i1].onclick;
                }
            }
        }
        this.ui = ui;
    }
    static default_ui = {
        fps: {
            br: true,
        },
        play: {
            space: true,
        },
        loop: {
            br: true,
        },
        pingpong: {
            br: true,
        },
        save: {
            br: true,
        },
        sheet: {
            br: true,
        },
    }
    get w() {
        return this.ctx.canvas.width;
    }
    set w(value) {
        this.ctx.canvas.width = value;
    }
    get h() {
        return this.ctx.canvas.height;
    }
    set h(value) {
        this.ctx.canvas.height = value;
    }
    get duration() {
        return this.frames.length;
    }
    set duration(value) {
        if(Number.isInteger(value) && value >= 0) {
            if(value < this.duration) {
                this.frames = this.frames.slice(0, value);
            }
            else if(value > this.duration) {
                let temp = this.ctx.getImageData(0, 0, this.w, this.h);
                this.clear();
                let i1 = 0;
                for(i1 = this.duration; i1 < value; i1++) {
                    this.frames[i1] = this.ctx.getImageData(0, 0, this.w, this.h);
                }
                this.ctx.putImageData(temp, 0, 0);
            }
        }
    }
    get frame() {
        return this._frame;
    }
    set frame(value) {
        if(this.duration === 0) {
            this._frame = 0;
        }
        else if(Number.isInteger(value)) {
            this._frame = value%this.duration;
        };
    }
    get playing() {
        return this._playing;
    }
    set playing(value) {
        if(this.duration === 0) {
            value = false;
        };
        this._playing = !!value;
        if(value) {
            let _this = this;
            this.interval = setInterval(function() { _this.updateframe(_this) }, 1000/this.fps);
        }
        else {
            clearInterval(this.interval);
            this.interval = null;
        };
        document.getElementById(this.name + `_play`).innerHTML = (value ? "pause" : "play");
    }
    clear() {
        this.ctx.clearRect(0, 0, this.w, this.h);
        this.ctx.fillStyle = this.background;
        this.ctx.fillRect(0, 0, this.w, this.h);
    }
    saveframe(frame, ctx, x, y) {
        ctx ??= this.ctx;
        x ??= 0;
        y ??= 0;
        this.frames[frame] = ctx.getImageData(x, y, this.w, this.h);
        if(this.frames.includes(undefined)) {
            this.clear();
            let i1 = 0;
            for(i1 = 0; i1 < this.duration; i1++) {
                if(!this.frames[i1]) {
                    this.frames[i1] = ctx.getImageData(0, 0, this.w, this.h);
                }
            }
            ctx.putImageData(this.frames[frame], 0, 0);
        };
    }
    updateframe(_this) {
        _this ??= this;
        if(_this.duration === 0) {
            _this.clear();
        }
        else {
            if(_this.playing) {
                _this.frame = posmod(_this.frame + (_this.reverse ? -1 : 1), _this.duration);
                // loop back to the opposite end if you reach the end. (that
                // way, when it reaches the end and isn't looping, it stops
                // at the first frame.)
                // - the order isn't 0 1 2 3, it's 1 2 3 0. (since it
                //   already starts at 0, and animations that aren't playing
                //   are supposed to show the first frame.)
            };
            _this.ctx.putImageData(_this.frames[_this.frame], 0, 0);
            if(_this.frame === ((!!_this.reverse === !!_this.pingpong) ? 0 : _this.duration - 1)) {
            // end of the animation, so stop the interval or switch
            // directions
            // - if pingpong is false
            //   - if reverse is false, the last frame is duration - 1, and
            //     it resets back to 0. so end at 0.
            //   - if reverse is true, the last frame is 0, and it resets
            //     back to duration - 1, so end at duration - 1
            // - if pingpong is true
            //   - if reverse is false, it should switch directions at
            //     duration - 1.
            //   - if reverse is true, it should switch directions or end at
            //     0.
            // - 0 if both are false or both are true. duration - 1
            //   otherwise.
                if(_this.pingpong) {
                // if it's not looping and it's already in the second
                // half, stop. no matter what, switch directions.
                    if(!_this.looping && _this.reverse) {
                        _this.playing = false;
                    };
                    _this.reverse = !_this.reverse;
                }
                else if(!_this.looping) {
                    _this.playing = false;
                };
            };
        };
    }
    playpause(_this) {
        _this ??= this;
        _this.playing = !_this.playing;
    }
    updatesheet(_this, ctx, cols, gap, gapcolor) {
    // makes the specified canvas a spritesheet of all the frames. or if
    // there's no ctx specified and the Animator has a sheet element, it
    // edits that.
        let i1 = 0;
        _this ??= this;
        ctx ??= _this.sheet;
        cols ??= _this.sheet_cols;
        gap ??= 0;
        gapcolor ??= _this.background;
        if((ctx ?? null) === null) {
            console.log("sheet canvas is unspecified.");
            return;
        };
        if((ctx ?? null) === null) {
            console.log("number of rows is unspecified.");
            return;
        };
        cols = cols ? cols : _this.duration;
        // if it's falsy, it'll print them all in one row.
        ctx.canvas.width = cols*_this.w;
        ctx.canvas.height = Math.ceil(_this.duration/cols)*_this.h;
        ctx.fillStyle = gapcolor;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for(i1 = 0; i1 < _this.duration; i1++) {
            ctx.putImageData(
                _this.frames[i1],
                (i1%cols)*(_this.w + gap),
                Math.floor(i1/cols)*(_this.h + gap)
            );
        }
    }
};
function numtohex(num, numofdigits) {
// converts an integer to a hexadecimal string
    if(!Number.isInteger(num) || num < 0) {
        console.log("invalid input. it must be a positive integer, or zero.");
        return;
    };
    let string = "";
    if(num === 0) {
        string = "0";
    }
    else {
        const digits = "0123456789abcdef";
        while(num) {
            let _num = posmod(num, 16);
            string = digits[_num] + string;
            num = Math.floor(num/16);
        }
    };
    if(Number.isInteger(numofdigits) && numofdigits >= 0) {
        string = (
            string.length > numofdigits ? string.slice(-numofdigits) :
            string.length < numofdigits ? ("0".repeat(numofdigits - string.length) + string) :
            string
        );
    }
    return string;
}
function getcolor(ctx, x, y, rgbaformat) {
    if(!Rect.inside(Rect.new(0, 0, ctx.canvas.width, ctx.canvas.height), x, y)) {
    // out of bounds
        return "";
    };
    let value = ctx.getImageData(x, y, 1, 1).data;
    if(rgbaformat) {
        value = "rgba(" + value.slice(0, 3).join(", ") + ", " + (value[3]/255) + ")";
    }
    else {
        let string = "#";
        for(let i1 = 0; i1 < value.length; i1++) {
            if(i1 !== 3 || value[i1] !== 255) {
                string += numtohex(value[i1], 2);
            }
        }
        value = string;
    }
    return value;
}
function colortohex(ctx, color) {
    let styletemp = ctx.fillStyle;
    ctx.fillStyle = color;
    let value = ctx.fillStyle;
    ctx.fillStyle = styletemp;
    if(value.startsWith("rgba(") && value.endsWith(")")) {
        let temp = value.slice("rgba(".length, -")".length).split(",");
        value = "#";
        if(temp.length !== 4) {
            console.log("this shouldn't happen");
            return;
        }
        for(let i1 = 0; i1 < 4; i1++) {
            let num = Number(temp[i1]);
            if(i1 === 3) {
                num = Math.round(256*num);
            };
            if(i1 === 3 && num === 256) {
                num = 255;
            }
            else if(!Number.isInteger(num) || num < 0 || num > 255) {
                console.log("this shouldn't happen");
                return;
            };
            //
            if(i1 !== 3 || num !== 255) {
                value += numtohex(num, 2);
            }
        }
    }
    return value;
}
function colorbutton(button, ctx, color) {
// styles a button so that the background is the color specified, while the text
// is colored as the opaque inversion of that color.
    button.style.backgroundColor = color;
    color = colortohex(ctx, color);
    let _color = [];
    for(let i1 = 0; i1 < 3; i1++) {
        _color[i1] = 255 - parseInt(color.slice(1 + 2*i1, 3 + 2*i1), 16);
    }
    _color = "rgb(" + _color.join(", ") + ")";
    button.style.color = _color;
    button.style.border = "thin solid " + _color;
    button.style.borderRadius = "8px";
}

class PixelArt {
// class that creates and operates a pixel art tool.
    constructor(container) {
        let i1 = 0;
        let i2 = 0;
        if(!(container instanceof HTMLElement)) {
            console.log("invalid input. you must give an html container for everything to go inside.");
            return;
        };
        this.html = {};
        this.html.container = container;
        this.zoom = 1;
        let display = "inline-block";
        let text = [
            "<div style=\"display: table\">",
            "<div style=\"display: " + display + "; place-items: center; align-items: center; justify-content: center; width: 256px; height: 256px; overflow: scroll; border: 2px dashed; background-color: orange\">",
            // - give it rigid dimensions
            // - use scroll bars if the insides get bigger than that
            // - center the canvas (no idea how it takes three properties to do
            //   that, but whatever.)
            // - add a dashed border
            "<canvas width=64 height=64 style=\"display: " + display + "image-rendering: crisp-edges; touch-action: none; border: 1px solid; scale: " + this.zoom + "\"></canvas>",
            // no anti-aliasing, and touching it on mobile shouldn't drag around the
            // page.
            "</div>",
            // viewport and canvas
            "<canvas name=\"palette\" style=\"display: " + display + "; image-rendering: crisp-edges\"></canvas>",
            // to the right of it, the palette canvas
            "<div style=\"display: " + display + "; height: 256px; overflow: scroll\">",
            "<button name=\"palette add\">add color</button>",
            "<button name=\"palette edit\">edit color</button>",
            "<br><button name=\"palette delete\">delete color</button>",
            "<br><button name=\"palette up\">shift up</button>",
            "<button name=\"palette down\">shift down</button>",
            "<br><button name=\"palette save\">save palette</button>",
            "<br><button name=\"palette clear\">clear palette</button>",
            "<br><button name=\"palette forecolor\">set as forecolor</button>",
            "<br><button name=\"palette backcolor\">set as backcolor</button>",
            "<br><button name=\"palette viewport\">set as viewport color</button>",
            "<br><button name=\"forecolor\" style=\"font-family: inherit\" disabled></button>",
            "<br><button name=\"backcolor\" style=\"font-family: inherit\" disabled></button>",
            "<br><button name=\"color switch\">color switch</button>",
            "</div>",
            // to the right of that, ui related to colors and palettes
            "</div>",
            //
            "<br><button name=\"undo\">undo</button><button name=\"redo\">redo</button>",
            "<label>zoom: <input type=\"number\" name=\"zoom\" value=1 step=.25 style=\"width: 3em\"></label>",
            "<br>tools:<ul>\n\t" + [
                "<label><input type=\"radio\" name=\"px_tool\" value=\"pen\"> pen</label> <label><input type=\"number\" name=\"pen r\" value=0 style=\"width: 4em\"> radius</label>",
                "<label><input type=\"radio\" name=\"px_tool\" value=\"eraser\"> eraser</label> <label><input type=\"number\" name=\"eraser r\" value=2 style=\"width: 4em\"> radius</label>",
                "<label><input type=\"radio\" name=\"px_tool\" value=\"colorpick\"> color picker</label> <button name=\"colorpick type\">" + PixelArt.valid.colorpick_type[0] + "</button>",
                "<label><input type=\"radio\" name=\"px_tool\" value=\"select\"> select</label>",
                "<label><input type=\"radio\" name=\"px_tool\" value=\"select cells\"> select cells</label>",
                "<label><input type=\"radio\" name=\"px_tool\" value=\"bucket\"> bucket fill</label> <label><input type=\"checkbox\" name=\"bucket diagonal\"> spread diagonally</label>"
                //  pen (radius)
                //  eraser (radius)
                //  color picker
                //  select
                //  select grid cells
                // select scale
                // select move
                // dither
                //  bucket (diagonal)
                // spray
                // rectangle, ellipse (fill)
                // line
                // text
                // color ramp (number, scale, curve, in/out, horizontal/vertical)
                // paste
            ].join("\n\t<br>"),
        ].join("\n");
        container.innerHTML = text;
        this.html.canvas = container.querySelector("canvas");
        this.html.viewport = this.html.canvas.parentElement;
        let _this = this;
        function addtohtml(element) {
            let list = element.children;
            for(let i1 = 0; i1 < list.length; i1++) {
                let ref = list[i1];
                let type = ref.tagName.toLowerCase();
                let name = (
                    ref.name
                    ??
                    (
                        "name" in ref.attributes ? ref.attributes.name.value :
                        type === "button" ? ref.innerHTML :
                        ""
                    )
                );
                name = name.replaceAll(" ", "_");
                if(name) {
                    _this.html[name] = list[i1];
                }
                addtohtml(list[i1]);
            }
        }
        addtohtml(container);
        //
        this.html.zoom.onchange = function(e) {
            let zoom = Number(_this.html.zoom.value);
            if(isNaN(zoom) || zoom === Infinity || zoom === -Infinity || zoom <= 0) {
                zoom = 1;
                _this.html.zoom.value = zoom;
            }
            if(zoom !== _this.zoom) {
                _this.zoom = zoom;
                _this.html.canvas.style.scale = _this.zoom;
            };
        }
        this.html.colorpick_type.onclick = function(e) {
            let values = PixelArt.valid.colorpick_type;
            e.target.innerText = values[(values.indexOf(e.target.innerText) + 1)%values.length];
        }
        // this makes the button act like a radio button or dropdown, pretty
        // much. clicking it makes the text cycle through the strings in that
        // array, and the current text of the button is used to get what "mode"
        // is currently selected.
        //
        this.html.palette_add.onclick = function(e) {
            let color = (prompt("enter a new color to add to the palette. you can add multiple colors by separating them with & symbols.") ?? "").trim();
            if(!color) {
                return;
            }
            color = color.split("&");
            for(let i1 = 0; i1 < color.length; i1++) {

                color[i1] = colortohex(_this.ctx, color[i1].trim());
                _this.remove_color(color[i1]);
                _this.palette.push(color[i1]);
            }
            _this.palette_index = _this.palette.length - 1;
            _this.refresh_palette();
        }
        this.html.palette_edit.onclick = function(e) {
            let color = (prompt("enter a new color to replace the selected color.") ?? "").trim();
            if(!color) {
                return;
            }
            color = colortohex(_this.ctx, color);
            if(color === _this.palette[_this.palette_index]) {
                return;
            }
            else if(_this.palette.includes(color)) {
                alert("that color is already in the palette.");
                return;
            }
            _this.palette[_this.palette_index] = color;
            _this.refresh_palette();
        }
        this.html.palette_delete.onclick = function(e) {
            if(_this.palette.length - 1 <= 0) {
                return;
            }
            _this.palette.splice(_this.palette_index, 1);
            _this.palette_index = Math.max(0, _this.palette_index - 1);
            _this.refresh_palette();
        }
        function movecolor(num) {
            if(_this.html.palette.length < 2 || !num) {
                return;
            }
            let index = _this.palette_index;
            num %= _this.palette.length;
            _this.palette_index = posmod(index + num, _this.palette.length);
            let sign = Math.sign(num);
            num = Math.abs(num);
            for(let i1 = 0; i1 < num; i1++) {
            // technically, a splicing operation would be more efficient. but as
            // of writing this, i don't even know if this will ever be used with
            // anything but 1 and -1. so i don't care.
                let neighbor = posmod(index + sign, _this.palette.length);
                let temp = _this.palette[neighbor];
                _this.palette[neighbor] = _this.palette[index];
                _this.palette[index] = temp;
                index = neighbor;
                // switch with a value right next to it.
            }
            _this.refresh_palette();
        }
        this.html.palette_up.onclick = function(e) { movecolor(1) };
        this.html.palette_down.onclick = function(e) { movecolor(-1) };
        this.html.palette_save.onclick = function(e) {
            _this.refresh_palette(true);
            savecanvas(_this.html.palette, _this.palette.join(" & ") + ".png");
            _this.refresh_palette();
        }
        this.html.palette_clear.onclick = function(e) {
            if(!confirm("are you sure you want to clear the palette?")) {
                return;
            }
            _this.palette = ["#000000", "#ffffff"];
            _this.palette_index = 0;
            _this.refresh_palette();
        }
        this.html.palette_forecolor.onclick = function(e) {
            _this.forecolor = _this.palette[_this.palette_index];
        }
        this.html.palette_backcolor.onclick = function(e) {
            _this.backcolor = _this.palette[_this.palette_index];
        }
        this.html.palette_viewport.onclick = function(e) {
            _this.html.viewport.style.backgroundColor = _this.palette[_this.palette_index];
        }
        this.html.color_switch.onclick = function(e) {
            let temp = _this.backcolor;
            _this.backcolor = _this.forecolor;
            _this.forecolor = temp;
        }
        //
        this.html.canvas.onpointerdown = function(e) { _this.mousedown(e, _this) };
        this.html.canvas.onpointermove = function(e) { _this.mousemove(e, _this) };
        this.html.canvas.onpointerup = function(e) { _this.mouseup(e, _this) };
        this.ctx = this.html.canvas.getContext("2d");
        let w = this.html.canvas.width;
        let h = this.html.canvas.height;
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.fillStyle = "black";
        let dither = dithers["x grid"];
        for(i1 = 0; i1 < w; i1++) {
            for(i2 = 0; i2 < h; i2++) {
                if(dither.func(
                    posmod(i1, dither.period.x),
                    posmod(i2, dither.period.y)
                )) {
                    //this.ctx.fillRect(i1, i2, 1, 1);
                }
            }
        }
        this.tool = "pen";
        this.select = null;
        this.cell = Rect.new(0, 0, 16, 16);
        this._forecolor = null;
        this._backcolor = null;
        this.forecolor = "black";
        this.backcolor = "white";
        // pen color, eraser color
        // - i don't think i need to initialize the underscored versions but
        //   whatever.
        // - this runs the setters, which set the style and text of the buttons
        this.palette = ["#000000", "#ffffff"].concat(Color.random(14, true, true));
        for(i1 = 2; i1 < this.palette.length; i1++) {
            this.palette[i1] = colortohex(this.ctx, this.palette[i1]);
        }
        this.palette_index = 0;
        // palette, and which color is selected for button stuff. NOTE: palette
        // colors must ALWAYS be in hexadecimal form. (6 digits, or 8 digits.)
        //
        this.palette_ctx = this.html.palette.getContext("2d");
        this.refresh_palette();
        this.html.palette.onclick = function(e) {
            let click = clickxy(e);
            let col = PixelArt.palette_col;
            let cell_w = PixelArt.palette_cell_w;
            let cell_h = PixelArt.palette_cell_h;
            let index = col*Math.floor(click[0]/cell_w) + col - 1 - Math.floor(click[1]/cell_h);
            if(index < _this.palette.length && index !== _this.palette_index) {
                _this.palette_index = index;
                _this.refresh_palette();
            }
        }
        //
        this.stroke = null;
        // data stored during a stroke
        let temp = document.getElementsByName("px_tool");
    	for(let i1 in temp) {
    		if(temp.hasOwnProperty(i1)) {
                if(temp[i1].value === PixelArt.valid.tools[0]) {
                    temp[i1].checked = true;
                };
    			temp[i1].onchange = function(e) {
                    if(PixelArt.valid.tools.includes(e.target.value)) {
                        _this.tool = e.target.value;
                    }
                    else {
                        console.log("this shouldn't happen");
                    }
    			}
    		}
    	}
        this.states = new States(
            _this, 32,
            function(tool) {
                return {
                    image: tool.ctx.getImageData(0, 0, tool.html.canvas.width, tool.html.canvas.height),
                    select: structuredClone(tool.select),
                };
            },
            function(tool, state) {
                tool.html.canvas.width = state.image.width;
                tool.html.canvas.height = state.image.height;
                tool.ctx.clearRect(0, 0, state.image.width, state.image.height);
                tool.ctx.putImageData(state.image, 0, 0);
                tool.select = structuredClone(state.select);
            }
        );
        this.html.undo.onclick = function(e) { _this.states.undo() };
        this.html.redo.onclick = function(e) { _this.states.redo() };
    }
    static valid = {
        tools: [
            "pen",
            "eraser",
            "colorpick",
            "select",
            "select cells",
            "bucket"
            //  pen (radius)
            //  eraser (radius)
            //  color picker
            //  select
            //  select grid cells
            // select scale
            // select move
            // dither
            //  bucket (diagonal)
            // spray
            // rectangle, ellipse (fill)
            // line
            // text
            // color ramp (number, scale, curve, in/out, horizontal/vertical)
            // paste
        ],
        colorpick_type: ["forecolor", "backcolor", "add to palette"],
    }
    static palette_col = 16
    // how many colors a column can have before a new column starts
    static palette_cell_w = 48
    static palette_cell_h = 16
    // how many pixels wide and tall one color of the palette is.
    refresh_palette(allcodes) {
    // refreshes the palette canvas to account for changes.
        let canvas = this.html.palette;
        let ctx = this.palette_ctx;
        let col = PixelArt.palette_col;
        let cell_w = PixelArt.palette_cell_w;
        let cell_h = PixelArt.palette_cell_h;
        let w = cell_w*Math.ceil(this.palette.length/col);
        let h = cell_h*col;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.font = "6px 'thick 4x4'";
        ctx.textBaseline = "middle";
        for(let i1 = 0; i1 < this.palette.length; i1++) {
            let x = Math.floor(i1/col);
            let y = col - i1%col;
            // the colors go from down to up, then left to right. like the
            // normal order, but rotated 90 counterclockwise.
            ctx.fillStyle = this.palette[i1];
            ctx.fillRect(x*cell_w, y*cell_h, cell_w, -cell_h);
            if(allcodes || i1 === this.palette_index) {
            // indicate the selected color by writing the hexcode inside.
                let temp = [];
                for(let i2 = 0; i2 < 3; i2++) {
                    temp[i2] = 255 - parseInt(this.palette[i1].slice(1 + 2*i2, 3 + 2*i2), 16);
                }
                ctx.fillStyle = "rgb(" + temp.join(", ") + ")";
                // the opposite color, and fully opaque if it wasn't already.
                ctx.fillText(this.palette[i1], x*cell_w + 2, (y - .5)*cell_h + 1);
            }
        }
    }
    remove_color(color) {
    // removes all instances of a color from the palette, and adjusts
    // palette_index to match.
    // - used to avoid duplicates.
    // - NOTE:
    //   - palette colors must always be hexcodes. (#, then 6 or 8 hexadecimal
    //     digits.)
    //   - this might empty the palette, or turn palette_index negative.
        let index = this.palette.indexOf(color);
        while(index in this.palette) {
            this.palette.splice(index, 1);
            if(this.palette_index >= index) {
                this.palette_index--;
            };
            index = this.palette.indexOf(color);
        }
    }
    //
    get pen_r() {
        let num = Number(this.html.pen_r.value);
        if(!Number.isInteger(num) || num < 0) {
            num = 0;
            this.html.pen_r.value = num;
        }
        return num;
    }
    get eraser_r() {
        let num = Number(this.html.eraser_r.value);
        if(!Number.isInteger(num) || num < 0) {
            num = 0;
            this.html.eraser_r.value = num;
        }
        return num;
    }
    get forecolor() {
        return this._forecolor;
    }
    set forecolor(value) {
        this._forecolor = colortohex(this.ctx, value);
        colorbutton(this.html.forecolor, this.ctx, this._forecolor);
        this.html.forecolor.innerHTML = this._forecolor;
    }
    get backcolor() {
        return this._backcolor;
    }
    set backcolor(value) {
        this._backcolor = colortohex(this.ctx, value);
        colorbutton(this.html.backcolor, this.ctx, this._backcolor);
        this.html.backcolor.innerHTML = this._backcolor;
    }
    clickxy(e) {
        return [
            Math.floor((e.clientX - e.target.getBoundingClientRect().left)/this.zoom),
            Math.floor((e.clientY - e.target.getBoundingClientRect().top)/this.zoom)
        ];
    }
    mousedown(e, _this) {
        let i1 = 0;
        _this ??= this;
        let click = _this.clickxy(e);
        _this.stroke = {
            before: _this.ctx.getImageData(0, 0, _this.html.canvas.width, _this.html.canvas.height),
            path: [structuredClone(click)],
        };
        //
        if(_this.tool === "pen" || _this.tool === "eraser") {
            _this.stroke.prev = null;
        }
        else if(_this.tool === "colorpick") {
            let type = _this.html.colorpick_type.innerText;
            let color = getcolor(_this.ctx, ...click);
            if(type === "forecolor" || type === "backcolor") {
                _this[type] = color;
                _this.tool = type === "backcolor" ? "eraser" : "pen";
                let list = document.getElementsByName("px_tool");
                let done = false;
                for(i1 = 0; i1 < list.length && !done; i1++) {
                    if(list[i1].value === _this.tool) {
                        list[i1].checked = true;
                        done = true;
                    }
                }
                if(!done) {
                    console.log("this shouldn't happen");
                };
            }
            else if(type === "add to palette") {
                this.remove_color(color);
                _this.palette.push(color);
                _this.palette_index = _this.palette.length - 1;
                _this.refresh_palette();
            }
            else {
                console.log("this shouldn't happen");
            }
            _this.stroke = null;
            // this is pretty much only a problem if it switches tools, but...
            // for this tool, things only happen at mousedown, so skip anything
            // at mousemove or mouseup.
        }
        else if(_this.tool === "bucket") {
            let diagonal = _this.html.bucket_diagonal.checked;
            let covered = [structuredClone(click)];
            // all points included in the fill.
            _this.stroke = null;
            _this.states.save();
        }
        //"pen",
        //"eraser",
        //"color picker",
        //"select",
        //"select cells",
        //"bucket"
    }
    mousemove(e, _this, finish) {
        let i1 = 0;
        _this ??= this;
        let click = _this.clickxy(e);
        let stroke = _this.stroke;
        if(!stroke) {
            return;
        }
        stroke.path.push(structuredClone(click));
        let w = _this.html.canvas.width;
        let h = _this.html.canvas.height;
        //
        if(_this.tool === "pen" || _this.tool === "eraser") {
            if(stroke.path.length) {
                let start = stroke.path[stroke.path.length - (stroke.path.length >= 2 ? 2 : 1)];
                let end = stroke.path[stroke.path.length - 1];
                let r = _this[_this.tool + "_r"];
                let coverage = null;
                if(r) {
                    coverage = Raster.capsule(...start, ...end, r);
                }
                else {
                    coverage = Rect.reach(Rect.new(...start, 0, 0), ...end);
                    coverage.w++;
                    coverage.h++;
                    coverage.raster = [];
                    for(i1 = 0; i1 < coverage.w*coverage.h; i1++) {
                        coverage.raster.push(false);
                    }
                    let points = linespecial(null, ...start, ...end);
                    for(i1 = 0; i1 < points.length; i1++) {
                        let index = Rect.getindex(coverage, ...points[i1]);
                        if(index === -1) {
                            console.log("this shouldn't happen");
                        }
                        else {
                            coverage.raster[index] = true;
                        }
                    }
                }
                _this.ctx.fillStyle = _this[(_this.tool === "eraser" ? "back" : "fore") + "color"];
                for(i1 = 0; i1 < coverage.raster.length; i1++) {
                    if(coverage.raster[i1]) {
                        let coor = Rect.getcoor(coverage, i1);
                        if(coor) {
                            if(stroke.prev) {
                                let index = Rect.getindex(stroke.prev, ...coor);
                                if(index !== -1 && stroke.prev.raster[index]) {
                                // exclude any pixel that was already in the
                                // previous segment. (the overlap would really
                                // mess things up if the user is trying to draw
                                // with a partially transparent color.)
                                    coor = null;
                                }
                            };
                            if(coor && (!this.select || !_this.select.w || !_this.select.h || Rect.inside(_this.select, ...coor))) {
                                _this.ctx.fillRect(...coor, 1, 1);
                            };
                        }
                    }
                }
                stroke.prev = structuredClone(coverage);
            }
        }
        //
        if(finish) {
            _this.stroke = null;
            _this.states.save();
        };
    }
    mouseup(e, _this) {
        _this.mousemove(e, _this, true);
    }
}
