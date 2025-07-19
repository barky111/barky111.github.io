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
        for(i1 = points.length - 1; i1 >= 0; i1--) {
        // splice
            if(deletepile.includes(i1)) {
                points.splice(i1, 1)
            };
        }
        let rect = Rect.frompoints(points);
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
    fineness = Number.isInteger(fineness) && fineness >= 0 ? fineness : 4;
    // avoid non-numbers and values like Infinity or NaN
    //console.log(new Date().valueOf());
    if(fineness !== 0) {
        fineness = Math.round(Math.abs(fineness));
    };
    const circle = [];
    for(i1 = 0; i1 < 4*fineness; i1++) {
        circle.push([
            Math.cos(2*Math.PI*i1/(4*fineness)),
            Math.sin(2*Math.PI*i1/(4*fineness))
        ]);
    }
    const sphere = fineness === 0 ? null : perfectsphere(fineness);
    function make_spheroid(array) {
    // array should be [x, y, z, w, h, d, orient]
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
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
            for(i1 = 0; i1 <= Math.floor(w); i1++) {
                for(i2 = 0; i2 <= Math.floor(h); i2++) {
                    for(i3 = 0; i3 <= Math.floor(d); i3++) {
                        let num = [i1, i2, i3];
                        if(orient) {
                            num = Quat.apply(inverse, [i1, i2, i3]);
                        };
                        if(roundspecial(Math.hypot(2*num[0]/w, 2*num[1]/h, 2*num[2]/d)) <= 1) {
                            for(i4 = 0; i4 < 2**3; i4++) {
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
            for(i1 in within) {
                if(within.hasOwnProperty(i1)) {
                    for(i2 in within[i1]) {
                        if(within[i1].hasOwnProperty(i2)) {
                            for(i3 = 0; i3 < within[i1][i2].length; i3++) {
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
            if(w && h && d) {
                for(i1 = 0; i1 < sphere.length; i1++) {
                    shape.push([
                        sphere[i1][0]*w/2,
                        sphere[i1][1]*h/2,
                        sphere[i1][2]*d/2
                    ]);
                }
                // scale it
            }
            else if(!w && !h && !d) {
                shape.push([0, 0, 0]);
            }
            else if(w && h) {
                for(i1 = 0; i1 < circle.length; i1++) {
                    shape.push([
                        circle[i1][0]*w/2,
                        circle[i1][1]*h/2,
                        0
                    ]);
                }
            }
            else if(w && d) {
                for(i1 = 0; i1 < circle.length; i1++) {
                    shape.push([
                        circle[i1][0]*w/2,
                        0,
                        circle[i1][1]*d/2
                    ]);
                }
            }
            else if(h && d) {
                for(i1 = 0; i1 < circle.length; i1++) {
                    shape.push([
                        0,
                        circle[i1][0]*h/2,
                        circle[i1][1]*d/2
                    ]);
                }
            }
            else if(w) {
                shape.push([-w/2, 0, 0]);
                shape.push([w/2, 0, 0]);
            }
            else if(h) {
                shape.push([-h/2, 0, 0]);
                shape.push([h/2, 0, 0]);
            }
            else if(d) {
                shape.push([-d/2, 0, 0]);
                shape.push([d/2, 0, 0]);
            }
            else {
                console.log("this shouldn't happen");
            };
            shape = orient ? Quat.orient(orient, shape) : shape;
            // orient the points of the sphere, relative to its center
            for(i1 = 0; i1 < sphere.length; i1++) {
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
    // - dark, light: booleans for whether it should add an especially dark or
    //   light color to the mix.
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
    hsvcalc: function(r, g, b) {
    // calculates hue, saturation, and value from rgb numbers.
    // - the inputs should be 0 to 255 numbers. the outputs are 0 to 1 numbers.
        let array = [r/255, g/255, b/255];
        let min = Math.min(...array);
        let max = Math.max(...array);
        let value = max;
        let saturation = 1 - min/max;
        let highest = [array[0] === max, array[1] === max, array[2] === max];
        if(!highest.includes(false)) {
            return [0, saturation, value];
        }
        else if(!highest.includes(true)) {
            console.log("this shouldn't happen");
            return;
        };
        let sector = (
            highest[0] ? (highest[1] ? 1 : 0) :
            highest[1] ? (highest[2] ? 3 : 2) :
            highest[2] ? (highest[0] ? 5 : 4) :
            null
        );
        // 0/6 red
        // 1/6 yellow
        // 2/6 green
        // 3/6 cyan
        // 4/6 blue
        // 5/6 magenta
        if(sector === null) {
            console.log("this shouldn't happen");
            return;
        }
        else if(sector%2) {
            return [sector/6, saturation, value];
        };
        let mid = (
            !highest[0] && array[0] !== min ? 0 :
            !highest[1] && array[1] !== min ? 1 :
            !highest[2] && array[2] !== min ? 2 :
            -1
        );
        if(mid === -1) {
            return [sector/6, saturation, value];
        };
        for(let i1 = 0; i1 < array.length; i1++) {
            array[i1] = (array[i1] - min)/(max - min);
        }
        highest = sector/2;
        let hue = sector/6;
        hue += (mid === (highest + 1)%3 ? array[mid]/6 : -(1 - array[mid]))/6;
        return [posmod(hue, 1), saturation, value];
    },
    named: [],
    initialize: function() {
        let named = `
pink:
MediumVioletRed C71585
DeepPink FF1493
PaleVioletRed DB7093
HotPink FF69B4
LightPink FFB6C1
Pink FFC0CB

red:
DarkRed 8B0000
Red FF0000
Firebrick B22222
Crimson DC143C
IndianRed CD5C5C
LightCoral F08080
Salmon FA8072
DarkSalmon E9967A
LightSalmon FFA07A

orange:
OrangeRed FF4500
Tomato FF6347
DarkOrange FF8C00
Coral FF7F50
Orange FFA500

yellow:
DarkKhaki BDB76B
Gold FFD700
Khaki F0E68C
PeachPuff FFDAB9
Yellow FFFF00
PaleGoldenrod EEE8AA
Moccasin FFE4B5
PapayaWhip FFEFD5
LightGoldenrodYellow FAFAD2
LemonChiffon FFFACD
LightYellow FFFFE0

brown:
Maroon 800000
Brown A52A2A
SaddleBrown 8B4513
Sienna A0522D
Chocolate D2691E
DarkGoldenrod B8860B
Peru CD853F
RosyBrown BC8F8F
Goldenrod DAA520
SandyBrown F4A460
Tan D2B48C
Burlywood DEB887
Wheat F5DEB3
NavajoWhite FFDEAD
Bisque FFE4C4
BlanchedAlmond FFEBCD
Cornsilk FFF8DC

purple:
Indigo 4B0082
Purple 800080
DarkMagenta 8B008B
DarkViolet 9400D3
DarkSlateBlue 483D8B
BlueViolet 8A2BE2
DarkOrchid 9932CC
Fuchsia FF00FF
Magenta FF00FF
SlateBlue 6A5ACD
MediumSlateBlue 7B68EE
MediumOrchid BA55D3
MediumPurple 9370DB
Orchid DA70D6
Violet EE82EE
Plum DDA0DD
Thistle D8BFD8
Lavender E6E6FA

blue:
MidnightBlue 191970
Navy 000080
DarkBlue 00008B
MediumBlue 0000CD
Blue 0000FF
RoyalBlue 4169E1
SteelBlue 4682B4
DodgerBlue 1E90FF
DeepSkyBlue 00BFFF
CornflowerBlue 6495ED
SkyBlue 87CEEB
LightSkyBlue 87CEFA
LightSteelBlue B0C4DE
LightBlue ADD8E6
PowderBlue B0E0E6

cyan:
Teal 008080
DarkCyan 008B8B
LightSeaGreen 20B2AA
CadetBlue 5F9EA0
DarkTurquoise 00CED1
MediumTurquoise 48D1CC
Turquoise 40E0D0
Aqua 00FFFF
Cyan 00FFFF
Aquamarine 7FFFD4
PaleTurquoise AFEEEE
LightCyan E0FFFF

green:
DarkGreen 006400
Green 008000
DarkOliveGreen 556B2F
ForestGreen 228B22
SeaGreen 2E8B57
Olive 808000
OliveDrab 6B8E23
MediumSeaGreen 3CB371
LimeGreen 32CD32
Lime 00FF00
SpringGreen 00FF7F
MediumSpringGreen 00FA9A
DarkSeaGreen 8FBC8F
MediumAquamarine 66CDAA
YellowGreen 9ACD32
LawnGreen 7CFC00
Chartreuse 7FFF00
LightGreen 90EE90
GreenYellow ADFF2F
PaleGreen 98FB98

white:
MistyRose FFE4E1
AntiqueWhite FAEBD7
Linen FAF0E6
Beige F5F5DC
WhiteSmoke F5F5F5
LavenderBlush FFF0F5
OldLace FDF5E6
AliceBlue F0F8FF
Seashell FFF5EE
GhostWhite F8F8FF
Honeydew F0FFF0
FloralWhite FFFAF0
Azure F0FFFF
MintCream F5FFFA
Snow FFFAFA
Ivory FFFFF0
White FFFFFF

gray&black:
Black 000000
DarkSlateGray 2F4F4F
DimGray 696969
SlateGray 708090
Gray 808080
LightSlateGray 778899
DarkGray A9A9A9
Silver C0C0C0
LightGray D3D3D3
Gainsboro DCDCDC
`;
        named = named.split("\n");
        let category = null;
        let repeat = [];
        for(let i1 = 0; i1 < named.length; i1++) {
            let line = named[i1].trim();
            if(!line) {
            }
            else if(line.endsWith(":")) {
                category = line.slice(0, -1);
            }
            else {
                line = line.split(" ");
                if(!category || line.length !== 2 || line[1].length !== 6) {
                    console.log("this shouldn't happen");
                }
                else {
                    let obj = {
                        name: line[0],
                        category,
                        code: "#" + line[1],
                        short_code: "#",
                        hue: null,
                        saturation: null,
                        value: null,
                    };
                    let rgb = [];
                    for(let i2 = 0; i2 < 3; i2++) {
                        rgb.push(parseInt(obj.code.slice(1 + 2*i2, 3 + 2*i2), 16));
                        obj.short_code += "0123456789ABCDEF"[ Math.round(rgb[i2]/17) ];
                    }
                    if(!repeat.includes(obj.short_code)) {
                    // if there's already another color that close to this one,
                    // skip it.
                        repeat.push(obj.short_code);
                        let hsv = Color.hsvcalc(...rgb);
                        obj.hue = hsv[0];
                        obj.saturation = hsv[1];
                        obj.value = hsv[2];
                        Color.named.push(obj);
                    }
                }
            }
        }
        Color.named.neutral_categories = ["white", "gray&black", "brown"];
        Object.defineProperty(Color.named, "neutral", {
            get() {
                return this.filter((element) => this.neutral_categories.includes(element.category));
            },
        });
        Object.defineProperty(Color.named, "vibrant", {
            get() {
                return this.filter((element) => !this.neutral_categories.includes(element.category));
            },
        });
    },
    split: function(string) {
    // splits a string of multiple colors into an array of each individual
    // color.
        let i1 = 0;
        let ranges = block_ranges(string, false, "(", ")");
        let colors = [];
        for(i1 = 0; i1 <= ranges.length; i1++) {
            let block = string_block(string, ranges, i1);
            if(!block) {
            }
            else if(i1%2) {
            // parenthesed content; count it as a single word.
                let start = block_start(string, ranges, i1);
                //let end = block_end(string, ranges, i1);
                if(start - 1 >= 0 && string[start - 1].trim() && colors.length) {
                // if there's no space before it, consider the previous word
                // part of this one
                    block = colors[colors.length - 1] + block;
                    colors.splice(colors.length - 1, 1);
                };
                colors.push(block);
            }
            else {
            // unparenthesed content: split it into words, and add each one
            // individually.
                colors = colors.concat(trimunspecial(block).split(" "));
            };
        }
        let separator = (char) => char.length === 1 && char.toUpperCase() === char.toLowerCase() && !"1234567890()".includes(char);
        let palette = [];
        for(i1 = 0; i1 < colors.length; i1++) {
            let color = colors[i1];
            if(separator(color.slice(-1))) {
                color = color.slice(0, -1);
            };
            // the syntax used to be that colors were separated with &
            // signs, and it's also just natural to use commas or
            // something... so, if the word is nothing but one non-letter,
            // non-digit, non-parenthese character, skip it, and if it ends
            // with a character like that, slice it off.
            palette.push(color.trim());
        }
        return palette;
    },
    format: function(color) {
    // returns a string of the format of the given color.
        let i1 = 0;
        if(color.startsWith("#") && [3, 4, 6, 8].includes(color.length - 1)) {
            let bool = true;
            for(i1 = 1; bool && i1 < color.length; i1++) {
                bool = "0123456789abcdef".includes(color[i1].toLowerCase());
            }
            return bool ? ("hex" + (color.length - 1)) : "unknown";
        }
        let temp = color.indexOf("(");
        if(temp !== -1 && color.endsWith(")")) {
            return color.slice(0, temp);
        }
        for(i1 = 0; i1 < Color.named.length; i1++) {
            if(Color.named[i1].name === color) {
                return "named";
            }
        }
        return "unknown";
    },
    palette_canvas: function(ctx, palette, col, cell_w, cell_h, reverse, one_code) {
    // uses the given canvas to visualize the given palette.
    // - NOTE: it orders them in columns, not rows.
    // - cell_w, cell_h: how big one color is.
    // - reverse: if true, columns start at the bottom and end at the top.
    // - one_code
    //   - a palette index: only that color has its code written on it. (useful
    //     for showing which one is selected.)
    //   - -1: no codes are shown.
    //   - any non-number: all codes are shown.
        col ??= 16;
        cell_w ??= 48;
        cell_h ??= 16;
        let w = cell_w*Math.ceil(palette.length/col);
        let h = cell_h*col;
        ctx.canvas.width = w;
        ctx.canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.font = "16px 'barkyfont'";
        ctx.textBaseline = "alphabetic";
        for(let i1 = 0; i1 < palette.length; i1++) {
            let color = palette[i1].toLowerCase();
            let format = Color.format(color);
            color = format.startsWith("hex") ? color : colortohex(ctx, color);
            let x = Math.floor(i1/col);
            let y = reverse ? col - i1%col : i1%col;
            // the colors go from down to up, then left to right. like the
            // normal order, but rotated 90 counterclockwise.
            ctx.fillStyle = color;
            ctx.fillRect(x*cell_w, y*cell_h, cell_w, (reverse ? -1 : 1)*cell_h);
            if(typeof one_code !== "number" || i1 === one_code) {
            // indicate the selected color by writing the hexcode inside.
                //*
                let invert = [];
                let inc = format === "hex3" || format === "hex4" ? 1 : 2;
                for(let i2 = 0; i2 < 3; i2++) {
                    invert[i2] = 255 - parseInt(color.slice(1 + inc*i2, 3 + inc*i2), 16);
                }
                let dark = Points.floor(Points.divide(invert, 8));
                let light = Points.subtract([255, 255, 255], invert);
                light = Points.floor(Points.divide(light, 8));
                light = Points.subtract([255, 255, 255], light);
                //*/
                let coor = [x*cell_w + 2, (y + (reverse ? -1 : 1)/2)*cell_h + 2];
                color = color.toUpperCase();
                ctx.fillStyle = "black";
                //ctx.fillStyle = "rgb(" + dark.join(", ") + ")";
                ctx.fillText(color, coor[0] + 1, coor[1]);
                ctx.fillText(color, coor[0] - 1, coor[1]);
                ctx.fillText(color, coor[0] + 1, coor[1] + 1);
                ctx.fillText(color, coor[0] - 1, coor[1] + 1);
                ctx.fillText(color, coor[0], coor[1] - 1);
                ctx.fillText(color, coor[0], coor[1] + 2);
                ctx.fillStyle = "rgb(" + invert.join(", ") + ")";
                ctx.fillText(color, coor[0], coor[1] + 1);
                ctx.fillStyle = "white";
                //ctx.fillStyle = "rgb(" + light.join(", ") + ")";
                // the opposite color, and fully opaque if it wasn't already.
                ctx.fillText(color, ...coor);
            }
        }
    }
};
Color.initialize();

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
    addrowcol: function(_this, w, l, r, u, d, value) {
    // adds or removes blank rows/columns.
    // - value: what value to fill the rows/columns with. 0 by default.
        let i1 = 0;
        l = typeof l === "number" ? Math.trunc(l) : 0;
        r = typeof r === "number" ? Math.trunc(r) : 0;
        u = typeof u === "number" ? Math.trunc(u) : 0;
        d = typeof d === "number" ? Math.trunc(d) : 0;
        value = typeof value === "undefined" ? 0 : value;
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
                    __this = __this.slice(0, i1).concat( arrayrepeat(value, l) ).concat( __this.slice(i1) );
                }
                else if(l < 0) {
                    __this = __this.slice(0, i1).concat( __this.slice(i1 - l) );
                };
                if(r > 0) {
                    __this = __this.slice(0, i1 + l + w).concat( arrayrepeat(value, r) ).concat( __this.slice(i1 + l + w) );
                }
                else if(r < 0) {
                    __this = __this.slice(0, i1 + l + w).concat( __this.slice(i1 + l + w - r) );
                };
            };
            w += l + r;
        };
        if(u > 0) {
            __this = arrayrepeat(value, u*w).concat(__this);
        }
        else if(u < 0) {
            __this = __this.slice(-u*w);
        };
        if(d > 0) {
            __this = __this.concat(arrayrepeat(value, d*w));
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
    outline: function(_this, w, diagonals, outer) {
    // returns a matching array of booleans for whether each pixel is an outline
    // or not. pixels count as outlines if they aren't falsy and have at least
    // one falsy cardinal neighbor. used in fill and the aa silhouette creation.
    // - diagonals: if true, pixels count as outline if they have *any* empty
    //   neighbors.
    // - outer: if true, pixels count as outline if they're empty pixels
    //   adjacent to filled pixels, rather than the other way around.
        let i1 = 0;
        let array = [];
        const h = Math.ceil(_this.length/w);
        for(i1 = 0; i1 < _this.length; i1++) {
            let _x = i1%w;
            let _y = Math.floor(i1/w);
            let l = _x === 0 ? false : !!_this[i1 - 1];
            let r = _x === (w - 1) ? false : !!_this[i1 + 1];
            let u = _y === 0 ? false : !!_this[i1 - w];
            let d = _y === (h - 1) ? false : !!_this[i1 + w];
            let ul = (_x === 0 || _y === 0) ? false : !!_this[i1 - w - 1];
            let ur = (_x === (w - 1) || _y === 0) ? false : !!_this[i1 - w + 1];
            let dl = (_x === 0 || _y === (h - 1)) ? false : !!_this[i1 + w - 1];
            let dr = (_x === (w - 1) || _y === (h - 1)) ? false : !!_this[i1 + w + 1];
            let edge = _x === 0 || _x === (w - 1) || _y === 0 || _y === (h - 1);
            array[i1] = !!(
                outer
                ?
                (
                    !_this[i1]
                    &&
                    (
                        l || r || u || d
                        ||
                        (
                            diagonals
                            &&
                            (ul || ur || dl || dr)
                        )
                    )
                )
                :
                (
                    _this[i1]
                    &&
                    (
                        !l || !r || !u || !d
                        ||
                        (
                            diagonals
                            &&
                            (!ul || !ur || !dl || !dr)
                        )
                    )
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
    totext: function(raster, w) {
        let text = "";
        for(let i1 = 0; i1 < raster.length; i1++) {
            if(i1 !== 0 && i1%w === 0) {
                text += "\n";
            };
            let num = Number(raster[i1]);
            text += "-%*"[Number.isInteger(num) ? Math.max(0, Math.min(num, 2)) : 0];
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
    findcoor: (raster, rect, x, y) => (
        (x < Rect.l(rect) || x >= Rect.r(rect) || y < Rect.u(rect) || y >= Rect.d(rect)) ? null :
        raster[rect.w*(y - rect.y) + (x - rect.x)]
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
    rewrite: function(raster, code) {
    // used for simple changes like setting all 2 values to 1.
        let _raster = [];
        for(let i1 = 0; i1 < raster.length; i1++) {
            _raster[i1] = code(raster[i1]);
        }
        return _raster;
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
        etc = typeof etc === "string" ? [etc] : Array.isArray(etc) ? etc : [];
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
            //let shape = _2dPoly.convexed( addspheroids(_points[i1], fineness) );
            let shape = PointSet2.convex(PointSet.convert(addspheroids(_points[i1], fineness), 2));
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
                    if(_points[i1].length > 1) {
                    // if there's only one point in the group, it's just out of
                    // bounds because the rectangle dimensions are zero or
                    // something.
                        console.log("this shouldn't happen (out of bounds Raster.from3d vertex.)");
                    };
                }
                else if(_points[i1][i2].length < 4) {
                // skip if it's a spheroid.
                    raster[index] = 2;
                };
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
    bucket: function(raster, w, x, y, diagonal) {
    // used for a paint bucket tool. give a raster and a coordinate, and it'll
    // return a raster of booleans, for which pixels have the same value as the
    // pixel at that coordinate and are connected to it by pixels that also have
    // the same value.
    // - diagonal: if true, the effect can spread diagonally instead of just
    //   cardinally.
        let i1 = 0;
        let i2 = 0;
        let empty = [];
        for(i1 = 0; i1 < raster.length; i1++) {
            empty.push(false);
        }
        const h = Math.ceil(raster.length/w);
        if(
            !Number.isInteger(x) || x < 0 || x >= w
            ||
            !Number.isInteger(y) || y < 0 || y >= h
        ) {
            return empty;
        }
        let _raster = structuredClone(empty);
        // the raster it returns in the end.
        let edge = structuredClone(empty);
        // raster for which pixels were added last iteration. to save time, it
        // only checks the neighbors of these pixels.
        _raster[w*y + x] = true;
        edge[w*y + x] = true;
        let value = raster[w*y + x];
        let done = false;
        while(!done) {
            done = true;
            let _edge = structuredClone(edge);
            edge = structuredClone(empty);
            for(i1 = 0; i1 < _edge.length; i1++) {
                if(_edge[i1]) {
                // for every pixel of the previous edge,
                    let _x = i1%w;
                    let _y = Math.floor(i1/w);
                    for(i2 = 0; i2 < 8; i2 += (diagonal ? 1 : 2)) {
                    // check every neighbor, cardinal and maybe diagonal
                        let __x = _x - (posmod(i2 - 3, 8) < 3) + (posmod(i2 - 7, 8) < 3);
                        let __y = _y - (posmod(i2 - 5, 8) < 3) + (posmod(i2 - 1, 8) < 3);
                        let index = w*__y + __x;
                        if(__x >= 0 && __x < w && __y >= 0 && __y < h && raster[index] === value && !_raster[index]) {
                        // if that neighbor exists, (ie it's in bounds) this
                        // pixel has the same value as the pixel the bucket fill
                        // started on, and this pixel isn't filled yet, add it
                        // to the new edge.
                            edge[index] = true;
                        }
                    }
                }
            }
            for(i1 = 0; i1 < edge.length; i1++) {
            // add the edge to _raster
                if(edge[i1]) {
                    done = false;
                    _raster[i1] = true;
                }
            }
        }
        return _raster;
    },
    draw: function(ctx, raster, x, y, w) {
        let rect = Rect.new(x, y, w, Math.ceil(raster.length/w));
        for(let i1 = 0; i1 < raster.length; i1++) {
            if(raster[i1]) {
                let coor = Rect.getcoor(rect, i1);
                if(coor === null) {
                    console.log("this shouldn't happen");
                }
                else {
                    ctx.fillRect(...coor, 1, 1);
                };
            }
        }
    },
    doublerow: (raster, w, row) => raster.slice(0, w*(row + 1)).concat( raster.slice(w*row, w*(row + 1)) ).concat( raster.slice(w*(row + 1)) ),
    // doubles a row, so there's an adjacent row that's identical.
    doublecol: function(raster, w, col) {
    // doubles a column.
        const h = Math.ceil(raster.length/w);
        let _raster = structuredClone(raster);
        for(let i1 = 0; i1 < h; i1++) {
            let index = (w + 1)*i1 + col;
            // +1 because doubling the column increases the width.
            _raster.splice(index, 0, structuredClone(_raster[index]));
        };
        return _raster;
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
    length: (point) => Math.hypot(...point),
    zero: (point) => !Points.length(point),
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
    angle: (point1, point2) => get2dangle(...Points.subtract(point2, point1), true),
}
let PointSet = {
// operation for groups of points. (can be 3d or 2d.)
    prev: (points, index) => points[posmod(index - 1, points.length)],
    next: (points, index) => points[posmod(index + 1, points.length)],
    centroid: (points) => Points.centroid(points),
    convert: function(points, dimension) {
    // converts 2d point sets to 3d, or vice versa.
        let _points = structuredClone(points);
        for(let i1 = 0; i1 < _points.length; i1++) {
            while(_points[i1].length < dimension) {
                _points[i1].push(0);
            };
            if(_points[i1].length > dimension) {
                _points[i1] = _points[i1].slice(0, dimension);
            };
        }
        return _points;
    },
    sort: function(points) {
    // sorts by the lowest x, and if points have equal x, the lowest y, and if
    // they have equal x and y, the lowest z, etc.
        if(!points.length) {
            return [];
        };
        let dimension = points[0].length;
        for(let i1 = 1; i1 < points.length; i1++) {
            if(points[i1].length !== dimension) {
                console.log("invalid input.");
                return;
            };
        }
        function sort(points, axis) {
            axis ??= 0;
            let _points = structuredClone(points);
            _points.sort((a, b) => a[axis] - b[axis]);
            for(let i1 = 0; axis + 1 < dimension && i1 < _points.length; i1++) {
                let num = _points[i1][axis];
                let end = i1;
                while(end < _points.length && _points[end][axis] === num) {
                    end++;
                };
                if(end - i1 > 1) {
                    let slice = sort(_points.slice(i1, end), axis + 1);
                    for(let i2 = 0; i2 < slice.length; i2++) {
                        _points[i1 + i2] = structuredClone(slice[i2]);
                    }
                };
                i1 = end - 1;
            }
            return _points;
        };
        return sort(points);
    },
    spline: function(points, num) {
        num = Math.max(0, Math.min(num, 1));
        if(points.length === 0) {
            console.log("this shouldn't happen");
            return [0, 0];
        }
        else if(points.length === 1) {
            return structuredClone(points[0]);
        };
        let point1 = PointSet.spline(points.slice(0, -1), num);
        let point2 = PointSet.spline(points.slice(1), num);
        return Points.add(Points.multiply(point1, 1 - num), Points.multiply(point2, num));
    },
};
let PointSet2 = {
// operations for groups of 2d points. usually, treating them like a closed
// shape.
    prevangle: (points, index) => Point2.angle(PointSet.prev(points, index), points[index]),
    // angle from the previous point to the given point
    nextangle: (points, index) => Point2.angle(points[index], PointSet.next(points, index)),
    // angle from the given point to the next point
    turn: function(points, index) {
        let prev = PointSet2.prevangle(points, index);
        let next = PointSet2.nextangle(points, index);
        let turn = posmod(next - prev, 2*Math.PI);
        return turn > Math.PI ? (turn - 2*Math.PI) : turn;
    },
    simplifylist: function(points) {
    // returns an array of indexes for what points to splice out. (points that
    // are identical to a neighbor, or fall perfectly on the line between their
    // neighbors. splicing these out won't affect the shape at all.)
        let list = [];
        for(let i1 = 0; i1 < points.length; i1++) {
            if(
                Points.zero(Points.subtract(PointSet.next(points, i1), points[i1]))
                ||
                PointSet2.prevangle(points, i1) === PointSet2.nextangle(points, i1)
            ) {
                list.push(i1);
            }
        }
        return list;
    },
    simplify: function(points) {
        let list = PointSet2.simplifylist(points);
        let _points = structuredClone(points);
        return _points.filter((element, index) => !list.includes(index));
    },
    clockwise: function(points) {
        let _points = PointSet2.simplify(points);
        if(_points.length < 3) {
            return true;
        };
        let total = 0;
        for(let i1 = 0; i1 < _points.length; i1++) {
            let turn = PointSet2.turn(_points, i1);
            total += turn > Math.PI ? (turn - 2*Math.PI) : turn === Math.PI ? 0 : turn;
        }
        return total >= 0;
    },
    convexorder: function(points) {
    // returns an array of indexes to connect to make the .convex shape.
        if(points.length < 3) {
            let order = [];
            while(order.length < points.length) {
                order.push(order.length);
            };
            return order;
        };
        let centroid = PointSet.centroid(points);
        let order = -1;
        let dist = 0;
        let angle = 0;
        points.forEach(function(element, index) {
            let diff = Points.subtract(element, centroid);
            let _dist = Points.length(diff);
            if(_dist > dist) {
                order = index;
                dist = _dist;
                angle = get2dangle(...diff, true);
            };
        });
        if(order === -1) {
            console.log("this shouldn't happen");
        };
        order = [order];
        // start with the point furthest from the center.
        angle = posmod(angle + Math.PI/2, 2*Math.PI);
        // from there, cast a ray out. start with the angle from the center to
        // the given point, and turn 90 degrees clockwise.
        let done = false;
        while(!done) {
        // after that, points are added by choosing whichever point the ray can
        // hit with the lowest clockwise turn. add that point, and cast the ray
        // out from there, with the new angle being the angle of the last
        // segment.
            let last = points[order[order.length - 1]];
            //*
            let oob = [];
            points.forEach(function(element, index) {
                let _angle = Points.subtract(element, last);
                if(!Points.zero(_angle)) {
                    _angle = posmod(get2dangle(..._angle, true) - angle, 2*Math.PI) - Math.PI;
                    _angle /= 2*Math.PI;
                    if(_angle > 0 && roundspecial(_angle)) {
                        oob.push(index + " (" + _angle + ")");
                    };
                };
            });
            if(oob.length) {
                console.log("this shouldn't happen");
            }
            //*/
            //
            let best_index = -1;
            let best_turn = 0;
            let best_dist = 0;
            let best_angle = 0;
            points.forEach(function(element, index) {
                if((!order.includes(index) || (index === order[0] && order.length > 1))) {
                    let diff = Points.subtract(element, last);
                    let dist = Points.length(diff);
                    let _angle = get2dangle(...diff, true);
                    let turn = posmod(_angle - angle, 2*Math.PI);
                    if(best_index === -1 || turn < best_turn || (!roundspecial(turn - best_turn) && dist > best_dist)) {
                        best_index = index;
                        best_turn = turn;
                        best_dist = dist;
                        best_angle = _angle;
                    };
                };
            });
            done = true;
            if(best_index === -1) {
                console.log("this shouldn't happen");
            }
            else if(order.length >= points.length) {
                console.log("this shouldn't happen");
                console.log(structuredClone(points));
                console.log(order);
            }
            else if(best_index !== order[0]) {
                order.push(best_index);
                angle = best_angle;
                done = false;
            };
            // - no valid candidates: that should be impossible.
            // - order is bigger than how many points there are: also
            //   impossible, and most definitely in some batshit hell-loop.
            // - the best choice is the first point: that means the shape is
            //   complete. nice.
            // - otherwise: continue until one of these happens.
        };
        return order;
    },
    convex: function(points) {
    // returns the smallest convex shape that would contain all the given
    // points.
    // - always returns a clockwise shape.
        let _points = [];
        let order = PointSet2.convexorder(points);
        for(let i1 = 0; i1 < order.length; i1++) {
            _points.push(structuredClone(points[order[i1]]));
        }
        return _points;
    },
    rect: function(points) {
    // returns the smallest rectangle that contains all points.
        if(!points.length) {
            return null;
        }
        let l = points[0][0];
        let r = points[0][0];
        let u = points[0][1];
        let d = points[0][1];
        for(let i1 = 1; i1 < points.length; i1++) {
            l = Math.min(l, points[i1][0]);
            r = Math.max(r, points[i1][0]);
            u = Math.min(u, points[i1][1]);
            d = Math.max(d, points[i1][1]);
        }
        return Rect.fromedges(l, r, u, d);
    },
};
let RasterRect = {
// pseudoclass for {x, y, w, h, raster} objects.
// - x, y, w, and h are always integers. w and h are always positive. (not even
//   zero is allowed. where possible, null will be returned instead.)
// - raster is an array of values for every pixel of said rectangle.
    shape: function(points, include_edge) {
    // enter a series of 2d points representing a closed shape. it can be
    // concave.
        let master = PointSet2.simplify(points);
        if(master.length < 3) {
            return null;
        };
        if(!PointSet2.clockwise(master)) {
            master.reverse();
        };
        function pointsfromindexes(indexes) {
            let _points = [];
            for(let i1 = 0; i1 < indexes.length; i1++) {
                _points.push(master[indexes[i1]]);
            }
            return _points;
        };
        function getshape(start, numofpoints, include_edge) {
        // returns a RasterRect of a shape. it recurses, calling itself on
        // cavities so it can subtract them.
        // - start: index of master to start at
        // - numofpoints: how many points there are. shapes are always
        //   consecutive points within master.
        // - if numofpoints is negative, it'll count backwards. this is
        //   important. start and numofpoints' values must always be such that
        //   when it creates a list of indexes from them, connecting those
        //   points in order will draw the shape in a clockwise direction, not
        //   counterclockwise.
            let i1 = 0;
            let i2 = 0;
            let indexes = [];
            let neg = numofpoints < 0;
            numofpoints = Math.abs(numofpoints);
            for(i1 = 0; i1 < numofpoints; i1++) {
                indexes.push(start + (neg ? -1 : 1)*i1);
            };
            // indexes within master
            let points = pointsfromindexes(indexes);
            let shape = Rect.round_out(PointSet2.rect(points));
            shape.w++;
            shape.h++;
            // add one so that the right column and bottom row aren't cut off.
            let turns = [];
            let concave = false;
            for(i1 = 0; i1 < points.length; i1++) {
                turns[i1] = PointSet2.turn(points, i1);
                concave = concave || turns[i1] < 0;
            }
            let _indexes = indexes;
            let _points = points;
            let cavities = [];
            if(concave) {
                _indexes = PointSet2.convexorder(points);
                _indexes.forEach(function(element, index, array) {
                    array[index] = indexes[element];
                });
                // convert them from indexes of the indexes array to indexes of
                // master
                _points = pointsfromindexes(_indexes);
                let omitted = structuredClone(indexes).filter((element) => !_indexes.includes(element));
                let shift = 0;
                while(posmod(omitted[posmod(shift - 1, omitted.length)] + 1, master.length) === omitted[posmod(shift, omitted.length)]) {
                    shift--;
                }
                // if omitted[0] is part of a consecutive series but isn't the
                // first, tick backward until you find the first of that series.
                for(i1 = 0; i1 < omitted.length; i1++) {
                    let _i1 = posmod(shift + i1, omitted.length);
                    // apply shift
                    let first = _i1;
                    let length = i1;
                    while(omitted[posmod(_i1 + 1, omitted.length)] === posmod(omitted[_i1] + 1, master.length)) {
                        i1++;
                        _i1 = posmod(shift + i1, omitted.length);
                    }
                    length = i1 - length;
                    let last = _i1;
                    // check if it's part of a consecutive series, and measure
                    // the length if so.
                    let start = posmod(omitted[first] - 1, master.length);
                    let end = posmod(omitted[last] + 1, master.length);
                    length += 2;
                    // convert from indexes of the omitted array to indexes of
                    // master. and remember, a cavity starts and ends at points
                    // that weren't omitted, that are adjacent to points that
                    // were.
                    cavities.push(neg ? {start: start, numofpoints: length} : {start: end, numofpoints: -length});
                    // if a shape is clockwise, the cavity will be
                    // counterclockwise. so, make sure the order of the cavity's
                    // indexes are the opposite direction as the order of the
                    // shape's indexes.
                }
            };
            let center = PointSet.centroid(_points);
            shape.raster = [];
            for(i1 = 0; i1 < shape.w*shape.h; i1++) {
                shape.raster.push(true);
            };
            for(i1 = 0; i1 < _points.length - Number(Math.abs(numofpoints) !== master.length); i1++) {
                let line = SL.new(..._points[i1], ...PointSet.next(_points, i1), center);
                let check = SL.check(line, ...center, shape.x, shape.y, shape.w, shape.h);
                for(i2 = 0; check && i2 < check.length; i2++) {
                    shape.raster[i2] = shape.raster[i2] && (check[i2] === 1 || (check[i2] === 0 && include_edge));
                };
            }
            // that weird Number() equation is for the open side of cavities.
            // - whether it's the whole shape, a cavity, a cavity of a cavity,
            //   etc, shapes are always a consecutive set of points within
            //   master.
            // - that means they always represent an edge within master.
            // - EXCEPT the line between the first and last point of a cavity.
            cavities.forEach(function(element) {
                let cavity = getshape(element.start, element.numofpoints, !include_edge);
                shape = RasterRect.subtract(shape, cavity);
            });
            return shape;
        };
        return getshape(0, master.length, include_edge);
        // find cavities
        // - check for weirdness
    },
    add: function(shape1, shape2, complex) {
    // adds two RasterRects together.
    // - complex: if true, it'll copy values instead of just using true for the
    //   value, and empty space will be null.
    //   - if both shape1 and shape2 have a truthy value for a coordinate, it'll
    //     use shape2's value.
    // - returns null if empty.
        if(!shape1 && !shape2) {
            return null;
        }
        else if(!shape1) {
            return structuredClone(shape2);
        }
        else if(!shape2) {
            return structuredClone(shape1);
        };
        let shape = Rect.contain(shape1, shape2);
        shape.raster = [];
        let empty = true;
        for(let i1 = 0; i1 < shape.w*shape.h; i1++) {
            let coor = Rect.getcoor(shape, i1);
            if(coor) {
                if(complex) {
                    let index2 = Rect.getindex(shape2, ...coor);
                    if(index2 !== -1 && shape2.raster[index2]) {
                        shape.raster[i1] = structuredClone(shape2.raster[index2]);
                        empty = false;
                    }
                    else {
                        let index1 = Rect.getindex(shape1, ...coor);
                        if(index1 !== -1 && shape1.raster[index1]) {
                            shape.raster[i1] = structuredClone(shape1.raster[index1]);
                            empty = false;
                        }
                        else {
                            shape.raster[i1] = null;
                        };
                    };
                }
                else {
                    shape.raster[i1] = (
                        (shape1.raster[Rect.getindex(shape1, ...coor)] ?? null)
                        ||
                        (shape2.raster[Rect.getindex(shape2, ...coor)] ?? null)
                    );
                    empty = empty && !shape.raster[i1];
                };
            }
            else {
                shape.raster[i1] = complex ? null : false;
                console.log("this shouldn't happen");
            }
        }
        return empty ? null : shape;
    },
    subtract: function(shape1, shape2, complex) {
    // subtracts shape2 from shape1.
    // - complex: if true, values will be erased by replacing them with null,
    //   rather than with false.
    // - returns null if empty.
    // - automatically crops rectangles to be the smallest they can be while
    //   fitting all truthy values.
        if(!shape1) {
            return null;
        };
        let shape = structuredClone(shape1);
        let empty = true;
        let l = null;
        let r = null;
        let u = null;
        let d = null;
        for(let i1 = 0; i1 < shape.w*shape.h; i1++) {
            let coor = Rect.getcoor(shape, i1);
            if(coor) {
                if(shape1.raster[i1]) {
                    if(shape2 && (shape2.raster[Rect.getindex(shape, ...coor)] ?? null)) {
                        shape.raster[i1] = complex ? null : false;
                    }
                    else if(empty) {
                        empty = false;
                        l = coor[0];
                        r = coor[0] + 1;
                        r = coor[1];
                        d = coor[1] + 1;
                    }
                    else {
                        l = Math.min(l, coor[0]);
                        r = Math.max(r, coor[0] + 1);
                        u = Math.min(u, coor[1]);
                        d = Math.max(d, coor[1] + 1);
                    }
                }
            }
            else {
                console.log("this shouldn't happen");
            };
        }
        if(empty) {
            return null;
        };
        let _shape = Rect.fromedges(l, r, u, d);
        _shape.raster = [];
        for(let i1 = 0; i1 < _shape.w*_shape.h; i1++) {
            let index = Rect.convertindex(_shape, shape, i1);
            if(index === -1) {
                console.log("this shouldn't happen");
                _shape.raster[i1] = complex ? null : false;
            }
            else {
                _shape.raster[i1] = structuredClone(shape.raster[index]);
            }
        }
        return _shape;
    },
    draw: function(shape, ctx) {
        if(!shape) {
            return;
        };
        for(let i1 = 0; i1 < shape.raster.length; i1++) {
            if(shape.raster[i1]) {
                let coor = Rect.getcoor(shape, i1);
                if(coor) {
                    ctx.fillRect(...coor, 1, 1);
                }
                else {
                    console.log("this shouldn't happen");
                };
            }
        }
    },
};
//
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
		if(this.disabled || this.range <= 0) {
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
		if(this.disabled || this.range <= 0) {
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
    findplace(point) {
    // does an inverse of findposition, which works even if the point isn't
    // on the line.
        if(!Array.isArray(point)) {
            point = [0, 0, 0];
        };
        let plane = this.plane();
        let place = plane.pointtotal( this.movetoline(point) );
        let sign = Math.sign(plane.pointtotal( this.findposition(1) ));
        return place*sign;
    }
    planeintersect(plane) {
    // returns the coordinates of a line/plane intersection.
        let point = Points.convert(this);
        let total = plane.pointtotal(point);
        if(!total) {
            return point;
        };
        let unit = plane.pointtotal(Angle.numbers(this.angle)) - plane.offset;
        if(!unit) {
        // parallel to the plane
            return 0;
        };
        return this.findposition(-total/unit);
        // - for a point to be on the plane, the pointtotal has to be zero.
        // - that is, point[0]*plane.x + plane[1]*plane.y + point[2]*plane.z +
        //   plane.offset must be zero.
        // - [line.x, line.y, line.z] has a pointtotal.
        // - since the intersection has to be on the line, it has to be a point
        //   that starts at [line.x, line.y, line.z] and moves some number of
        //   units in line.angle to get pointtotal to zero.
        // - and that isn't so difficult to figure out. if it's just a matter of
        //   how many times we add Angle.numbers(line.angle)...
        // - you just have to figure out how much adding one of those changes
        //   the pointtotal. then do division.
    }
    movetoline(point) {
    // moves the given point to a place on the line, using perpendicular
    // planes.
        if(!point) {
            point = [0, 0, 0];
        };
        return this.planeintersect(this.plane().parallel(point));
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
    // UNFINISHED.
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
    // UNFINISHED.
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
    static frompoints(point1, point2, point3) {
    // creates a plane from the three points specified.
        let dA = {
            x: point2[0] - point1[0],
            y: point2[1] - point1[1],
            z: point2[2] - point1[2],
        };
        // distances from point 0 to point 1
        let dB = {
            x: point3[0] - point1[0],
            y: point3[1] - point1[1],
            z: point3[2] - point1[2],
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
        let offset = -(xmod*point1[0] + ymod*point1[1] + zmod*point1[2]);
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
    pointsign(point) {
    // returns -1, 0, or 1 for which side of the plane the point is on.
        return Math.sign(this.pointtotal(point));
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
        let intersect = line.planeintersect(this);
        if(
            intersect === null
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
            flip: xor(_this.flip, quat.flip),
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
        ];
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
    zero: (_this) => !Quat.magnitude(_this),
    axis_magnitude: function(_this) {
        let magnitude = Quat.magnitude(_this);
        let axis = Math.sin(magnitude);
        axis = (
            (axis && (_this.x || _this.y || _this.z))
            ?
            Angle.get(
                _this.x/axis,
                _this.y/axis,
                _this.z/axis
            )
            :
            null
        );
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
        _this
        &&
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
        let _quat1 = Quat.normalized(quat1);
        let _quat2 = Quat.normalized(quat2);
        let dot = Quat.dot(_quat1, _quat2);
        let num1 = 1 - num;
        let num2 = num;
        if(dot < 0) {
            _quat2.w *= -1;
            _quat2.x *= -1;
            _quat2.y *= -1;
            _quat2.z *= -1;
        };
        dot = Math.abs(dot);
        if(1 - dot > epsilon()) {
            let temp1 = Math.acos(dot);
            let temp2 = Math.sin(temp1);
            num1 = Math.sin(num1*temp1)/temp2;
            num2 = Math.sin(num2*temp1)/temp2;
        };
        return {
            w: num1*_quat1.w + num2*_quat2.w,
            x: num1*_quat1.x + num2*_quat2.x,
            y: num1*_quat1.y + num2*_quat2.y,
            z: num1*_quat1.z + num2*_quat2.z,
            flip: (num < .5 ? _quat1 : _quat2).flip,
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
        silhouette: "body_exclusive",
        // object of properties related to silhouette color and shape.
        // - group: which index of AAX.Color.silhouette to use
        // - subgroup: a string. parts with the same group but distinct
        //   subgroups will have different outlines. (ex: separating the head
        //   from the body, or the left arm from the right.)
        // - anc: a number for how many generations of ancestors to add. ex: 1
        //   means the parent, 2 means the parent and grandparent. 1 by default.
        // - desc: the same, but for descendants. 0 by default.
        // - core: the diameter of a sphere at the center of the part.
        // - bone: a diameter. adds the bone between the part and its parent,
        //   made into a capsule shape. used as an approximation of a neck.
        // - silhouettes are formed by adding all of those images together, plus
        //   the part's main image, and convexing them.
        // - concave: if true, the convexing will happen before the part's main
        //   image and the bone are added.
        shape: "",
        orient: "no_default",
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
    body_read: {
    // an object of functions used in Body.new and body maker.
        comment_char: "//",
        uncomment: (text) => uncomment(text, AAX.body_read.comment_char, "\n", true, true),
        validname: (name) => (
            name.trim() !== name ? "whitespace at the beginning or end of a part name isn't allowed." :
            // .trim is used a lot in text interpretation processes.
            name.includes("\n") ? "part names cannot have line breaks." :
            // multi-line part names are not accounted for, on account of it
            // being dumb as hell
            name.includes(",") ? "part names cannot have commas." :
            // posescript uses commas to split up actions, and actions can have
            // part names in them.
            // - it uses commas for combining part selections, too.
            (name.includes("[") || name.includes("]")) ? "part names cannot have brackets." :
            // posescript uses brackets for coordinates. putting brackets in
            // part names could mess with the word split process, since a set of
            // brackets counts as a single word.
            (name.includes("(") || name.includes(")")) ? "part names cannot have parentheses." :
            // posescript uses parentheses for some things, like the omit
            // addendum of rotate.
            name.includes("//") ? "part names cannot have \"//\"." :
            // used for comments in body interpretation and posescript.
            name.includes(":") ? "part names cannot have colons." :
            // used in bodytext extra text and posescript part-targeting.
            !name ? "part names cannot be blank." :
            name === "standpoint" ? "\"standpoint\" is a reserved word." :
            // used in parenting to indicate having no parent at all.
            (name in AAX.Body.prototype) ? "\"" + name + "\" is an invalid part name for technical reasons." :
            // matches an object/Body method/property. (ex: making a part called
            // "hasOwnProperty" will cover up the hasOwnProperty method and make
            // it unusable)
            ""
        ),
        // if the inputted name isn't allowed, it'll return a string explaining
        // why. otherwise, it'll return an empty string.
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
                    let error = AAX.body_read.validname(name);
                    if(error) {
                        return "invalid input. " + error;
                    };
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
            let i1 = 0;
            let i2 = 0;
            //
            let comments = comment_finder(text, AAX.body_read.comment_char, "\n", true, true);
            let _text = "";
            for(let i1 = 0; i1 <= comments.length; i1 += 2) {
                _text += string_block(text, comments, i1);
            };
            // uncomment it, but save where the comments were
            let ranges = block_ranges(_text, false, "(", ")");
            let colons = [];
            for(i1 = 0; i1 <= ranges.length; i1 += 2) {
                let start = block_start(_text, ranges, i1);
                let block = string_block(_text, ranges, i1);
                let place = block.indexOf(":");
                while(place !== -1) {
                    colons.push(start + place);
                    place = block.indexOf(":", place + 1);
                }
            };
            // find all colons that are outside parentheses
            /*
            let log = _text;
            for(i1 = 0; i1 < colons.length; i1++) {
                let index = colons[i1] + 2*i1;
                log = log.slice(0, index) + "[" + log[index] + "]" + log.slice(index + 1);
            }
            console.log(log);
            // log
            //*/
            for(i1 = 1; i1 <= comments.length; i1 += 2) {
                let start = block_start(text, comments, i1);
                let end = block_end(text, comments, i1);
                for(i2 = 0; i2 < colons.length; i2++) {
                    if(colons[i2] >= start) {
                        colons[i2] += end - start;
                    }
                }
            }
            // adjust colon indexes to account for the comments that were
            // removed
            /*
            log = text;
            for(i1 = 0; i1 < colons.length; i1++) {
                let index = colons[i1] + 2*i1;
                log = log.slice(0, index) + "[" + log[index] + "]" + log.slice(index + 1);
            }
            console.log(log);
            // log
            //*/
            text = text.split("\n");
            let place = 0;
            let colons_index = 0;
            let name = "";
            let obj = {};
            for(i1 = 0; i1 < text.length; i1++) {
                let line = text[i1];
                let colon = colons_index < colons.length ? colons[colons_index] : -1;
                const namechange = colon !== -1 && colon < place + line.length;
                if(colon !== -1 && colon < place) {
                    console.log("this shouldn't happen");
                };
                if(namechange) {
                    name = line.slice(0, colon - place).trim();
                    obj[name] ??= "";
                    line = line.slice(colon - place + 1);
                };
                if(!namechange || line) {
                // don't add the post-colon text as a new line if it's empty.
                    obj[name] += (obj[name] ? "\n" : "") + line.trim();
                };
                //
                place += text[i1].length + 1;
                while(colons_index < colons.length && colons[colons_index] < place) {
                    colons_index++;
                }
            }
            // split
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
		//   - branch_silgroup, silgroup: arrays of a silhouette group and
        //     subgroup.
        //     - it needs to be stored separately, so that non-branching can
        //       override branching.
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
							let temp = AAX.Shape.new(image[0], obj, i1);
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
				if(obj.hasOwnProperty(i1)) {
                // run through all the possible commands extra_text can give.
                    let part = obj[i1];
                    part.hide = false;
                    part.symmetry = null;
                    part.silhouette = {
                        group: 0,
                        subgroup: "",
                        anc: 1,
                        desc: 0,
                        core: 0,
                        bone: 0,
                        concave: false,
                    };
                    part.orient = Quat.new();
                    let commands = [];
                    if(part.extra_text) {
                        commands = AAX.body_read.extra_commands(part.extra_text);
                        delete part.extra_text;
                    };
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
                        else if(ref.name === "group" || ref.name === "group*") {
                        // silhouette group/subgroup, branch_silgroup
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
                            part[(branch ? "branch_" : "") + "silgroup"] = [num, sub];
                        }
                        else if(ref.name === "generation") {
                        // silhouette ancestor/descendants
                            content = content ? content.split(",") : [];
                            content = [
                                Number(content[0] ?? 0),
                                Number(content[1] ?? 0)
                            ];
                            if(!Number.isInteger(content[0]) || !Number.isInteger(content[1])) {
                                return "invalid input. (generation() inputs are supposed to be integers representing how many generations back/forward you want the part to connect to.)";
                            }
                            else {
                                part.silhouette.anc = content[0];
                                part.silhouette.desc = content[1];
                            };
                        }
                        else if(ref.name === "core" || ref.name === "bone") {
                        // silhouette core/bone
                            content = AAX.posint(content);
                            if(isNaN(content)) {
                                return "invalid input. (invalid " + ref.name + " diameter.)";
                            };
                            part.silhouette[ref.name] = content;
                        }
                        else if(ref.name === "concave") {
                            part.silhouette[ref.name] = true;
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
                        }
                        else if(ref.name === "tilt") {
                            part.orient = AAX.strings.tilt(content);
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
						"orient",
						"shape",
						"image",
						"perspective",
						"hide",
						"silhouette"
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
                if(property === "silgroup") {
                    body[part].silhouette.group = values[0][0];
                    body[part].silhouette.subgroup = values[0][1];
                }
                else {
                    body[part][property] = structuredClone(values[0]);
                }
				let temp = structuredClone(values[0]);
				values.splice(0, 1);
				values.push(temp);
				// cycle through
				for (i1 in body) {
					if(body.hasOwnProperty(i1) && body[i1].parent === part) {
						branchassign(body, i1, property, structuredClone(values));
					};
				}
			};
            for(i1 in body) {
                if(body.hasOwnProperty(i1) && body[i1].parent === "standpoint") {
                // set the default colors
                    branchassign(body, i1, "color1", [1, 2]);
                    branchassign(body, i1, "color2", [0]);
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
					if(obj[i1].hasOwnProperty("branch_silgroup")) {
						branchassign(body, i1, "silgroup", [obj[i1].branch_silgroup]);
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
                    if(obj[i1].hasOwnProperty("silgroup")) {
                        body[i1].silhouette.group = obj[i1].silgroup[0];
                        body[i1].silhouette.subgroup = obj[i1].silgroup[1];
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
                    if(body[name1].silhouette.group && !body[name1].silhouette.subgroup) {
                    // if they're not in group 0 (probably don't want them
                    // differentiated) and they don't have a subgroup already,
                    // (the user probably already did something with that,
                    // which shouldn't be disturbed) put them in different
                    // silhouette subgroups.
                        let temp = symmetry[i1].prefix1;
                        for(i2 = 0; i2 < temp.length; i2++) {
                            body[name1].silhouette.subgroup += temp[i2].toLowerCase() === temp[i2].toUpperCase() ? "" : temp[i2];
                        }
                        temp = symmetry[i1].prefix2;
                        for(i2 = 0; i2 < temp.length; i2++) {
                            body[name2].silhouette.subgroup += temp[i2].toLowerCase() === temp[i2].toUpperCase() ? "" : temp[i2];
                        }
                        // have it match the prefixes, with all non-letters
                        // removed for aesthetics
					};
                    body[name2].mirror = true;
                    // makes sure the part's orient starts as a Quat.mirror.x().
                    AAX.mirror(body, name2, "x");
                    // coordinates, image, perspective, orient
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
   thumb_3:		-2, -8, 0
    thumb_4:	0, -7, 0
 index_1:		-9, -24, -1
  index_2:		0, -12, 0
   index_3:		0, -8, 0
    index_4:	0, -5, 0
 middle_1:		-1, -25, -3
  middle_2:		0, -13, 0
   middle_3:	0, -8, 0
    middle_4:	0, -5, 0
 ring_1:		6, -23, -1
  ring_2:		0, -11, 0
   ring_3:		0, -8, 0
    ring_4:		0, -5, 0
 pinkie_1:		13, -20, 1
  pinkie_2:		0, -7, 0
   pinkie_3:	0, -7, 0
    pinkie_4:	0, -6, 0
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
    color1*(3)
	group(0a)
    generation(0, 1)
thumb_1:
    color1(4, 3)
    generation()
    tilt(local, xy: 1/36, xz: -1/12)
thumb_2:
    group(0b)
    generation(2)
    tilt(xz: -1/8)
thumb_3:
    tilt(xz: -1/8)
//thumb_4:
index_1:
    group(1a)
    generation()
//index_2:
//index_3:
//index_4:
middle_1:
	group(1b)
    generation()
//middle_2:
//middle_3:
//middle_4:
ring_1:
    group(1c)
    generation()
//ring_2:
//ring_3:
//ring_4:
pinkie_1:
    group(1d)
    generation()
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
	generation()
headbase:
	bone(16)
    concave()
head:
    group(0b)
	generation()
manubrium:
	generation()
shoulder:
	symmetry()
	color1(3, 4)
	group(1)
	generation()
hand:
	generation()
hip:
	symmetry()
	group(2)
    generation()`,
			standard:
`pelvis: 0, -38, 0
 midsection: 0, -3, 3
 torso: 0, -10, 0.5
  neckbase: 0, -9, -0.5
   headbase: 0, -6, 0
    head: 0, -12, 0
  manubrium: -1, -4, 4.5
   shoulder: -8, 4, -6
    elbow: -2.5, 11.5, -0.5
     hand: -1.5, 11.5, 2.5
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
0, 0, 0, 4
[ hand ]
||
-----------------
-----------------
-----------------
-----------------
-----------------
-----------------
-----------------
-----------------
-------%%%-------
------%%%%%------
------%%%%%------
-----%%%%%%------
----%%%%%%%------
----%%%%%%-------
-----%%%%%%------
------%%%%-------
-------%%--------
|
-------------------
-------------------
-------------------
-------------------
-------------------
-------------------
-------------------
-------------------
--------%%%%-------
-------%%%%%%------
-------%%%%%%%-----
------%%%%%%%%-----
------%%%%%%%%%----
------%%%%%%%%%----
------%%%%%%%%%----
------%%%%%%%%-----
------%%%%%%%------
-------%%%%%%------
--------%%%--------
[ hip ]
0, 0, 0, 9
[ knee ]
0, 0, 0, 6
[ ankle ]
0, 0, 0, 6
[ toe ]
0, 0, 0, 5, 1, 1
2, 0, 2, 2
###
midsection:
	color1*(3)
torso:
	color1(2, 1)
	generation(1, 2)
neckbase:
	generation()
headbase:
	group(0b)
	bone(8)
	generation()
	concave()
head:
	group(0b)
	generation()
	concave()
manubrium:
	symmetry()
	generation()
shoulder:
	color1(3, 4)
	group(1)
	generation()
elbow:
	tilt(xz: 1/12)
hand:
	core(4)
	concave()
	tilt(yz: 1/24, xy: 1/36)
    // align with the forearm angle, so it better represents
    // pronation/supination
hip:
	symmetry()
	color1(1, 2)
knee:
	group(2)`,
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
                let quat1 = Quat.normalized(this.orient);
                let quat2 = Quat.normalized(orient);
                this.orient = Quat.normalized( Quat.slerp(quat1, quat2, num) );
                /*
                let log = this.name === "head";
                if(log) {
                    console.log("-");
                    console.log(quat1);
                    console.log(quat2);
                    console.log(Quat.axis_magnitude(quat1));
                    console.log(Quat.axis_magnitude(quat2));
                };
                //
                let temp = [
                    Quat.zero(quat1) ? null : Quat.axis_magnitude(quat1),
                    Quat.zero(quat2) ? null : Quat.axis_magnitude(quat2)
                ];
                if(temp[0] && temp[1]) {
                    let axis = Angle.between(temp[0].axis, temp[1].axis, num);
                    let magn = [
                        posmod(temp[0].magnitude, 2*Math.PI),
                        posmod(temp[1].magnitude, 2*Math.PI)
                    ];
                    let change = posmod(magn[1] - magn[0], 2*Math.PI);
                    change -= change > Math.PI ? 2*Math.PI : 0;
                    magn = posmod(magn[0] + num*change, 2*Math.PI);
                    this.orient = Quat.new(axis, magn);
                    if(log) {
                        console.log(Quat.axis_magnitude(this.orient));
                        console.log(magn);
                        console.log("nyeh,");
                    };
                }
                else if(temp[0] || temp[1]) {
                    let _num = temp[0] ? 1 - num : num;
                    temp = temp[0] || temp[1];
                    let axis = temp.axis;
                    let magn = posmod(temp.magnitude, 2*Math.PI);
                    magn -= magn > Math.PI ? 2*Math.PI : 0;
                    magn = posmod(_num*magn, 2*Math.PI);
                    this.orient = Quat.new(axis, magn);
                    if(log) {
                        console.log(Quat.axis_magnitude(this.orient));
                        console.log(magn);
                    };
                };
                //*/
                /*
                let angle = Math.acos(Quat.dot(quat1, quat2));
                //(q1*sin((1-t)*angle) + q2*sin(t*angle))/denom
                //(quat1*Math.sin((1 - num)*angle) + quat2*Math.sin(num*angle))/Math.sin(angle)
                this.orient = Quat.new();
                for(let i1 = 0; i1 < 4; i1++) {
                    let num1 = quat1["wxyz"[i1]];
                    let num2 = quat2["wxyz"[i1]];
                    this.orient["wxyz"[i1]] = (num1*Math.sin((1 - num)*angle) + num2*Math.sin(num*angle))/Math.sin(angle);
                }
                //*/
                /*
                let invert = (quat) => Quat.multiply_num(quat, -1);
                let multiply = (quat1, quat2) => false ? Quat.multiply(quat1, quat2) : Quat.local_multiply(quat1, quat2);
                let method = 0;
                this.orient = (
                    method === 0 ? multiply(quat1, Quat.multiply_num(multiply(invert(quat1), quat2), num)) :
                    method === 1 ? multiply(quat2, Quat.multiply_num(multiply(invert(quat2), quat1), 1 - num)) :
                    method === 2 ? multiply(Quat.multiply_num(multiply(quat1, invert(quat2)), 1 - num), quat2) :
                    method === 3 ? multiply(Quat.multiply_num(multiply(quat2, invert(quat1)), num), quat1) :
                    this.orient
                );
                //*/
                //this.orient = Quat.normalized(this.orient);
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
                    //value = AAX.sq_raster.autocrop(value, AAX.l_dim(value.length, this.image_oddness(view))[0]);
                    console.log("= " + this.name + " =");
                    value = AAX.sq_raster.autocrop(value, this.image_oddness(view));
                    console.log(value);
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
            data = Raster.from3d(points, drawsettings.fineness || 8, _abscoor, perspectived ? drawsettings.viewer : null, "aa");
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
            let sil = this.silhouette;
            let list = [this.name];
            list = sil.anc ? list.concat(AAX.getanc(this.pose, this.name).slice(-sil.anc)) : list;
            list = sil.desc ? list.concat(AAX.getdesc(this.pose, this.name, sil.desc)) : list;
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
            // now, combine those shapes according to how the parts' silhouettes
            // work. (skip hidden parts.)
                let sil = pose[i1].silhouette;
                let list = pose[i1].silhouettelist;
                if(sil.concave) {
                // if it's concave, don't convex the main shape with all the
                // others.
                    list.splice(list.indexOf(i1), 1);
                };
                let group = [];
                for(i2 = 0; i2 < list.length; i2++) {
                // combine the partshapes of itself and all applicable
                // ancestors and descendants.
                    group = group.concat(structuredClone(partshapes[ list[i2] ]));
                }
                if(sil.core) {
                    group.push([...all_abs[i1], sil.core]);
                };
                if(sil.bone && pose[i1].parent !== "standpoint") {
                    let start = [...all_abs[i1], sil.bone];
                    let end = [...all_abs[pose[i1].parent], sil.bone];
                    if(sil.concave) {
                    // make a new group
                        groups.push([structuredClone(start), structuredClone(end)]);
                    }
                    else {
                    // add to the old one
                        group.push(structuredClone(start));
                        group.push(structuredClone(end));
                    };
                };
                if(group.length) {
                    groups.push(group);
                };
                if(sil.concave) {
                    let shape = pose[i1].orientedshape;
                    for(i2 = 0; i2 < shape.length; i2++) {
                    // if it's concave, add each group of the shape as a new
                    // group of the final product.
                        let group = [];
                        for(i3 = 0; i3 < shape[i2].length; i3++) {
                            let point = structuredClone(shape[i2][i3]);
                            point[0] += all_abs[i1][0];
                            point[1] += all_abs[i1][1];
                            point[2] += all_abs[i1][2];
                            group.push(point);
                        }
                        if(group.length) {
                            groups.push(structuredClone(group));
                        };
                    }
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
        let _poseobj = structuredClone(poseobj);
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
        get perspectived_standpoint() {
            let x = this.standpoint.x;
            let y = this.standpoint.y;
            if(this.range !== "none") {
                let temp = [0, 0, this.viewer.central_z];
                temp = Points.subtract(this.viewer.convert(...temp), temp);
                x += Math.trunc(temp[0]);
                y += Math.trunc(temp[1]);
            };
            return {x, y};
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
        AAX.DrawSettings.template.standpoint.x = Math.floor(AAX.DrawSettings.template.cell.w/2 + AAX.DrawSettings.template.standpoint.x);
        AAX.DrawSettings.template.standpoint.y = Math.floor(AAX.DrawSettings.template.cell.h/2 + AAX.DrawSettings.template.standpoint.y);
        // they start out relative to the center
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
            AAX.Shape.templates[_i1] = temp[_i1].split("\n||\n")[0];
            if(_i1 === "head") {
                AAX.Body.templates.stocky = AAX.Body.templates.stocky.replace("[ " + _i1 + " ]", "[ " + _i1 + " ]\n" + AAX.Shape.templates[_i1]);
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
        font: "16px 'barkyfont'",
        margin: [2, 1 - 5],
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
            let baselinetemp = ctx.textBaseline;
            //ctx.textBaseline = "middle";
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
            ctx.textBaseline = baselinetemp;
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
        checkbox: function(ctx, color, x, y, type) {
        // draws the box of a checkbox.
        // - color: an array of three colors, like DrawSettings.buttons
        // - type:
        //   - "checked"
        //   - "unchecked"
        //   - "special check" (draws a filled square instead of an x)
        //   - "radio off" (unselected radio button)
        //   - "radio on" (selected radio button)
        //   =
        //   - if it isn't one of these, it'll pick checked or unchecked based
        //     on whether it's truthy.
        // - NOTE: remember to take one block off the left side of your rect.
        //   that way.
            let styletemp = [ctx.fillStyle, ctx.strokeStyle];
            const types = "checked / unchecked / special check / radio off / radio on".split(" / ");
            type = types.includes(type) ? type : type ? "checked" : "unchecked";
            //
            let box = Rect.expand_all(Rect.new(x, y, AAX.ui.block, AAX.ui.block), -1);
            ctx.fillStyle = color[1];
            if(type === "radio off" || type === "radio on") {
                let full = Raster.fullellipse(box.w, box.h);
                Raster.draw(ctx, full, box.x, box.y, box.w);
                ctx.fillStyle = color[0];
                let outline = Raster.outline(full, box.w);
                Raster.draw(ctx, outline, box.x, box.y, box.w);
                if(type === "radio on") {
                    let center = [];
                    for(let i1 = 0; i1 < full.length; i1++) {
                        center[i1] = full[i1] && !outline[i1];
                    }
                    let _outline = Raster.outline(center, box.w);
                    for(let i1 = 0; i1 < full.length; i1++) {
                        center[i1] = center[i1] && !_outline[i1];
                    }
                    Raster.draw(ctx, center, box.x, box.y, box.w);
                }
            }
            else {
                ctx.strokeStyle = color[0];
                ctx.fillRect(box.x + 1, box.y + 1, box.w, box.h);
                Rect.fauxstroke(box, ctx);
                box = Rect.expand_all(box, -2);
                ctx.strokeStyle = bm.color.buttons[0];
                if(type === "checked") {
                    linespecial(ctx, box.x, box.y, box.x + box.w, box.y + box.h);
                    linespecial(ctx, box.x + box.w, box.y, box.x, box.y + box.h);
                }
                else if(type === "special check") {
                    ctx.fillRect(box.x, box.y, box.w + 1, box.h + 1);
                };
            }
            //
            ctx.fillStyle = styletemp[0];
            ctx.strokeStyle = styletemp[1];
        }
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
    coortext: function(point) {
        let i1 = 0;
        let text = point.slice(0, 3);
        let align = [];
        for(i1 = 0; i1 < text.length; i1++) {
        // - convert numbers to strings
        // - make sure there's a sign, unless it's zero
        // - take note of how many characters in the decimal point is, for
        //   alignment
            text[i1] = " +".charAt(Math.sign(text[i1])) + text[i1];
            let temp = text[i1].indexOf(".");
            align[i1] = temp === -1 ? text[i1].length : temp;
        }
        let max = Math.max(...align, 3);
        // i don't like that it looks all weird and jump transitioning from all
        // single-digits to having at least one double-digit. technically it's
        // inconsistent, but who cares.
        for(i1 = 0; i1 < Math.min(point.length, 3); i1++) {
            text[i1] = "xyz"[i1] + ":" + " ".repeat(max - align[i1]) + text[i1];
            text[i1] = text[i1].replaceAll(" ", "&#160;").replaceAll(":", ": ");
        }
        return text;
    },
    writecoordinates: function(div, text) {
    // used in armature artist and body maker to draw coordinates and/or node
    // names under the canvas.
    // - you can enter arrays or coordinate arrays. it interprets null as "reset
    //   to default", which is generally however many line breaks guarantees
    //   that the stuff after this won't be moving back and forth.
        if(Array.isArray(text)) {
            if(text.length === 3 && typeof text[0] === "number" && typeof text[1] === "number" && typeof text[2] === "number") {
                text = AAX.coortext(text);
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
    noderadius: 2,
    // how close a click has to be to count as clicking a node.
    //noderadius_mouse: 1,
    // - this was going to be a noderadius that only applies if they're using a
    //   mouse. mouse users can use a more strict noderadius since the node
    //   highlighting that happens with mouse hover gives you enough feedback to
    //   be crazy precise with your clicks.
    // - but that'd be awkward to adjust if i ever make it possible to change
    //   noderadius. and there just isn't much reason not to be more lax.
    //   - it's easy to tell if a click was from a mouse, pen, or touch, but not
    //     to tell which one is the device "default". we may think of it as pc =
    //     mouse and phone = touch, but either device could use any of these.
    //   - i could use a document.onpointerdown thing to set the expected click
    //     type when the user first clicks but whatever...
    draw_background: function(ctx, drawsettings, color, perspectived, viewtype, side_tint_invert) {
    // - ctx: canvas context
    // - drawsettings, color: an AAX.DrawSettings, an AAX.Color
    // - perspectived: boolean for whether it's in perspective
    // - viewtype: something in AAX.valid.viewtype. describes what views it's
    //   drawing.
    //   - "multi4": all 4 views
    //   - "multi2": view 0 and 1
    //   - 0, 1, 2, 3: just one view
        let i0 = 0;
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
        ) {
            console.log("invalid arguments.");
            return;
        }
        let ref = drawsettings;
        viewtype = AAX.valid.viewtype.includes(viewtype) ? viewtype : "multi4";
        let viewlist = viewtype === "multi4" ? [0, 1, 2, 3] : viewtype === "multi2" ? [0, 1] : [viewtype];
        let cell = ref.cell;
        ctx.canvas.width = cell.w;
        ctx.canvas.height = cell.h;
        let imagedata = [];
        for(let i0 = 0; i0 < viewlist.length; i0++) {
            view = viewlist[i0];
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
                        let temp = ref.perspectived_standpoint;
                        coor[0] += ((view === 1 || view === 2) ? -1 : 0)*(temp.x - ref.standpoint.x);
                        coor[1] += temp.y - ref.standpoint.y;
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
            if(ref.background !== "blank" && invertboolean(view%2, side_tint_invert)) {
                // add side tint
                ctx.fillStyle = color.side_tint;
                ctx.fillRect(0, 0, cell.w, cell.h);
            };
            imagedata.push(ctx.getImageData(0, 0, cell.w, cell.h));
        }
        loop.end();
        ctx.canvas.width = viewlist.length*cell.w;
        ctx.clearRect(0, 0, viewlist.length*cell.w, cell.h);
        for(i1 = 0; i1 < viewlist.length; i1++) {
            ctx.putImageData(imagedata[i1], i1*cell.w, 0);
        }
    },
    draw: function(
        ctx, drawsettings, color, perspectived, viewtype,
        pose, nodes, strokecache, rotatecoor, basis
    ) {//yyyaad
    // draws or redraws the main canvas, the one with the multiview on it.
    // - NOTE it also defines the nodes.
    // - viewtype: something in AAX.valid.viewtype. describes what views it's
    //   drawing.
    //   - "multi4": all 4 views
    //   - "multi2": view 0 and 1
    //   - 0, 1, 2, 3: just one view
    // - rotatecoor: the return of an aa.rotatecoor running, with the
    //   absolute argument as true. used in the rotate pose tool's mid-click
    //   visualization. parts in here will be drawn differently.
    // - basis: used to draw axes.
        //let time = new Date().valueOf();
        let i0 = 0;
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let i4 = 0;
        let loop = new Loop("AAX.draw", 10000);
        let view = 0;
        let ds = drawsettings;
        viewtype = AAX.valid.viewtype.includes(viewtype) ? viewtype : "multi4";
        let viewlist = viewtype === "multi4" ? [0, 1, 2, 3] : viewtype === "multi2" ? [0, 1] : [viewtype];
        nodes ??= [[], [], [], []];
        let coortocanvas = (point, view, nonulls, viewoffset) => AAX.coortocanvas(ds.cell, ds.standpoint, point, view, nonulls, viewoffset);
        let nodeline = function(x1, y1, x2, y2, view, viewoffset) {
            let center = coortocanvas([0, 0, 0], view, true, viewoffset);
            center[0] += .5;
            center[1] += .5;
            linespecial(ctx, x1, y1, x2, y2, center);
        };
        let getnode = (view, name) => AAX.getnode(nodes, view, name);
        let imagedata = [];
        for(i1 = 0; i1 < viewlist.length; i1++) {
            loop.tick(1);
            imagedata.push(ctx.getImageData(i1*ds.cell.w, 0, ds.cell.w, ds.cell.h));
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
                node.y
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
        for(i0 = 0; i0 < viewlist.length; i0++) {
            view = viewlist[i0];
            loop.tick("view");
            ctx.putImageData(imagedata[i0], 0, 0);
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
                    _nodes.push({
                        x: coor[0],
                        y: coor[1],
                        z: ds.screen_z(abs[i1], view, perspectived),
                        name: i1,
                    });
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
                            let group = ds.silhouette === "overlap" ? [pose[_i2].silhouette.group, pose[_i2].silhouette.subgroup] : [0, ""];
                            for(i3 = groups.length; i3 <= group[0]; i3++) {
                                groups.push({});
                            }
                            groups[ group[0] ][ group[1] ] ??= [];
                            // it'll be an array of _2dPoly.getdatas, for now
                            let sil = pose[_i2].silhouette;
                            let convex = [];
                            let list = pose[_i2].silhouettelist;
                            if(sil.concave) {
                                list.splice(list.indexOf(_i2), 1);
                            };
                            for(i3 = 0; i3 < list.length; i3++) {
                                convex = convex.concat(temp[ list[i3] ]);
                            }
                            let node = getnode(view, _i2);
                            let x = node.x - view*ds.cell.w;
                            let y = node.y;
                            if(sil.core) {
                                let rect = Raster.dimrect(
                                    AAX.onedim(sil.core, !!(x%1)),
                                    AAX.onedim(sil.core, !!(y%1))
                                );
                                rect.x += x;
                                rect.y += y;
                                let core = Raster.fullellipse(rect.w, rect.h);
                                convex = convex.concat(Raster._2dPoly(core, rect));
                            };
                            let bone = null;
                            if(sil.bone && pose[_i2].parent !== "standpoint") {
                                let parent = getnode(view, pose[_i2].parent);
                                let _x = parent.x - view*ds.cell.w;
                                let _y = parent.y;
                                bone = Raster.capsule(x, y, _x, _y, sil.bone/2);
                                if(!sil.concave) {
                                    let _convex = Raster._2dPoly(bone.raster, bone.w);
                                    for(i3 = 0; i3 < _convex.length; i3++) {
                                        convex.push([
                                            bone.x + _convex[i3][0],
                                            bone.y + _convex[i3][1]
                                        ]);
                                    }
                                }
                            };
                            convex = convex.length < 3 ? null : _2dPoly.getdata(_2dPoly.convexed(convex), true, sl_center);
                            let shape = sil.concave ? [] : convex;
                            if(sil.concave) {
                                if(convex) {
                                    shape.push(convex);
                                };
                                if(bone) {
                                    shape.push({rect: Rect.new(bone.x, bone.y, bone.w, bone.h), within: bone.raster});
                                };
                                let image = partimage(pose[_i2], view);
                                let oddness = [!!(x%1), !!(y%1)];
                                let dim = AAX.l_dim(image.length, oddness);
                                if(dim === null) {
                                    console.log("this shouldn't happen");
                                }
                                let rect = Raster.dimrect(...dim);
                                rect.x += x;
                                rect.y += y;
                                // make it relative to the top left corner of
                                // the cell
                                shape.push({
                                    rect,
                                    within: image,
                                });
                                // _2dPoly.getdata format.
                                shape = _2dPoly.mergedata(shape);
                            };
                            shape ??= {rect: Rect.new(0, 0, 0, 0), within: []};
                            groups[ group[0] ][ group[1] ].push( structuredClone(shape) );
                            // add to the data for this combo
                            single[_i2] = {
                                x: shape.rect.x,
                                y: shape.rect.y,
                                w: shape.rect.w,
                                h: shape.rect.h,
                                raster: structuredClone(shape.within),
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
                            let raster = _rect.raster;
                            for(i2 = 0; i2 < raster.length; i2++) {
                                if(array[i2]) {
                                    // if the part covers this spot:
                                    let index = Rect.getindex(rect, ...Rect.getcoor(_rect, i2));
                                    // Rect.getcoor is the coordinates relative to
                                    // the corner of the cell, Rect.getindex is
                                    // which index of image.raster that should be.
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
            imagedata[i0] = ctx.getImageData(0, 0, ds.cell.w, ds.cell.h);
        }
        loop.end();
        ctx.canvas.width = viewlist.length*ds.cell.w;
        ctx.clearRect(0, 0, viewlist.length*ds.cell.w, ds.cell.h);
        for(i1 = 0; i1 < viewlist.length; i1++) {
            ctx.putImageData(imagedata[i1], i1*ds.cell.w, 0);
        }
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
            let local = false;
            // used to make rotations use local axes instead of true axes.
            for(let i1 = 0; i1 < string.length; i1++) {
                string[i1] = string[i1].trim();
                if(invert[i1] !== -1) {
                    tilt ??= Quat.new();
                    tilt = Quat.mirror["xyz"[ invert[i1] ]](tilt);
                }
                else if(string[i1] === "local") {
                    local = true;
                }
                else if(string[i1] === "true") {
                    local = false;
                }
                else {
                    let rotation = string[i1].split(":");
                    if(rotation.length >= 2) {
                        let axis = rotation[0].trim();
                        let angle = posmod(readnumber(rotation[1]) ?? 0, 1);
                        // can use fractions
                        if(["yz", "xz", "xy"].includes(axis) && angle) {
                            tilt ??= Quat.new();
                            tilt = (
                                local
                                ?
                                Quat.local_rotate(tilt, axis, 2*Math.PI*angle)
                                :
                                Quat.rotate(tilt, axis, 2*Math.PI*angle)
                            );
                        };
                    }
                }
            }
            return tilt;
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
    getstemnum: (body, part) => AAX.getchildren(body, "standpoint").indexOf(AAX.getstem(body, part)),
    getfill: (color, body, part) => color.part_fill[AAX.getstemnum(body, part)%color.part_fill.length],
    // returns the appropriate part_fill color to use for the given part.
    valid: {
    // stores arrays for which values are accepted, whether to check for
    // validity or iterate through them. mostly for drawsettings.
        posetools: ["move", "deform", "tilt", "rotate", "perspective", "select"],
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
        view: ["front", "right", 0, 1, 2, 3],
        refresh: ["draw", "ui", "states"],
        part_properties: ["", "no_default", "body_exclusive", "pose_exclusive", "pose_getset"],
        // valid part_properties types
        rotate_type: ["true", "local", "custom"],
        rotate_axis_setters: "parent child cross true local written".split(" "),
        px_export: "frame anim all_x all_y".split(" "),
        viewtype: ["multi4", "multi2", 0, 1, 2, 3],
        // used in draw_background and draw.
        hidelist: "part branch group body all".split(" "),
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
        part.orient = Quat.mirror[axis](part.orient);
        // .orient
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
    Shape: {
    // a pseudoclass. an object of functions related to the shapes you can use
    // in armature artist and body maker.
        new: function(string) {
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            let loop = new Loop("AAX.Shape.new");
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
                                        point.push(structuredClone(tilt));
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
        string: function(shape) {
        // inverse of new. turns it into a string.
        // - NOTE: comments aren't preserved after a shape string is turned into
        //   a shape and turned back into a string.
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
                                    if(point[i3].hasOwnProperty(i4) && i4 !== "flip") {
                                        line.push(i4 + ": " + point[i3][i4]);
                                    }
                                }
                                //if(point[i3].flip) {
                                //    line.push("flip");
                                //}
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
        templates: {
        // most of these will be created from AAX.Body.templates.standard, in
        // AAX.initialize.
        // - note that these are text, not shapes.
            sphere: `0, 0, 0, 8`,
        },
        radius: function(points) {
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
        bounds: function(points) {
        // used in body maker. the edges of the smallest box the shape could fit in.
        // - NOTE: again, it does NOT account for spheroid rotation.
        // - returns null if the shape has no points, or if any of the
        //   dimensions would be zero.
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
            return (bounds === null || bounds.l === bounds.r || bounds.u === bounds.d || bounds.b === bounds.f) ? null : bounds;
        },
        bisect: function(points, fineness, plane_pos, plane_quat) {
        // returns the bisection of a shape.
        // - plane_pos, plane_quat: this is used instead of a Plane... the plane
        //   it uses is whatever plane could be made from [0, 0, 0] and the x
        //   and y axes of plane_quat's basis, shifted so that plane_pos is on
        //   it. (pos means "position" and quat means "quaternion".)
        // - structure:
        //   - plus: a version of the points that only has the points on the
        //     positive side of the plane. (the direction that plane_quat's
        //     positive z direction points.)
        //   - minus: a version of the points that only has the points on the
        //     negative side.
        //   - zero: points that are in both halves, whether from already being
        //     on the plane or being created on the spot to give the halves the
        //     proper shape.
        // - you can complete the shapes by copying the zero points to plus and
        //   minus, and deleting zero.
            let i0 = 0;
            let i1 = 0;
            let i2 = 0;
            let _points = addspheroids(points, fineness);
            let inv_quat = Quat.invert(plane_quat);
            let temp = Quat.basis(plane_quat);
            let proper_plane = Plane.frompoints(
                plane_pos,
                Points.add(plane_pos, temp[0]),
                Points.add(plane_pos, temp[1])
            );
            let toplanespace = (point) => Quat.apply(inv_quat, Points.subtract(point, plane_pos));
            let minus = [];
            let zero = [];
            let plus = [];
            for(i0 = 0; i0 < _points.length; i0++) {
            // since the logic is built on the shape being convex, do the
            // process separately for each point group.
                minus.push([]);
                zero.push([]);
                plus.push([]);
                for(i1 = 0; i1 < _points[i0].length; i1++) {
                    let point = _points[i0][i1];
                    let sign = Math.sign(toplanespace(point)[2]);
                    if(sign === -1) {
                        minus[i0].push(structuredClone(point));
                    }
                    else if(sign === 0) {
                        zero[i0].push(structuredClone(point));
                    }
                    else if(sign === 1) {
                        plus[i0].push(structuredClone(point));
                    };
                }
                // sort points by whether they're on the negative side of the
                // plane, on the plane, or on the positive side of the plane.
                for(i1 = 0; i1 < minus[i0].length; i1++) {
                    for(i2 = 0; i2 < plus[i0].length; i2++) {
                        zero[i0].push(Line.frompoints(minus[i0][i1], plus[i0][i2]).planeintersect(proper_plane));
                    }
                }
                // for every pair of points on opposite sides of the plane, add
                // the point where the line between those points intersects with
                // the plane.
                let _zero = [];
                for(i1 = 0; i1 < zero[i0].length; i1++) {
                    _zero[i1] = toplanespace(zero[i0][i1]);
                }
                _zero = PointSet.convert(_zero, 2);
                _zero = PointSet2.convexorder(_zero);
                for(i1 = zero[i0].length - 1; i1 >= 0; i1--) {
                // iterate backwards so indexes don't get screwed up
                    if(!_zero.includes(i1)) {
                        zero[i0].splice(i1, 1);
                    }
                }
                // use convexing to remove unnecessary interior points.
            }
            return {minus, zero, plus};
        },
        linear_slice: function(points, fineness, plane_pos, plane_quat, plane_num, plane_spacing) {
        // - points: shape points
        // - fineness: used in addspheroids
        // - plane_pos: a point that's on the first slice's plane
        // - plane_quat: the z axis of the basis is perpendicular to the basis,
        //   and it's the direction the plane moves for further cuts.
        // - plane_num: number of planes the shape is cut by. (the number of
        //   slices is this +1.)
        // - plane_spacing: spacing between cuts.
            let _points = addspheroids(points, fineness);
            let slices = [];
            let basis = Quat.basis(plane_quat);
            for(let i1 = 0; i1 < plane_num; i1++) {
                slices[i1] = AAX.Shape.bisect(_points, fineness, Points.add(plane_pos, Points.multiply(basis[2], i1)), plane_quat);
            }
            let sectors = [];
            for(let i1 = 0; i1 <= slices.length; i1++) {
                sectors[i1] = structuredClone(i1 === slices.length ? slices[slices.length - 1].plus : slices[i1].minus);
                if(i1 && i1 < slices.length) {
                    sectors[i1] = sectors[i1].filter((point) => slices[i1 - 1].plus.some((_point) => compareobject(point, _point)));
                };
                if(i1) {
                    for(let i2 = 0; i2 < slices[i1 - 1].zero.length; i2++) {
                        sectors[i1][i2] = sectors[i1][i2].concat(structuredClone(slices[i1 - 1].zero[i2]));
                    }
                };
                if(i1 < slices.length) {
                    for(let i2 = 0; i2 < slices[i1].zero.length; i2++) {
                        sectors[i1][i2] = sectors[i1][i2].concat(structuredClone(slices[i1].zero[i2]));
                    }
                };
            }
            return sectors;
        },
        radial_slice: function(points, fineness, plane_pos, plane_quat, plane_num) {
        // cuts around the line, rather than along the line.
            let _points = addspheroids(points, fineness);
            let slices = [];
            for(let i1 = 0; i1 < plane_num; i1++) {
                let quat = Quat.local_rotate(plane_quat, "yz", Math.PI/2);
                quat = Quat.local_rotate(plane_quat, "xz", -2*Math.PI*i1/plane_num);
                slices[i1] = AAX.Shape.bisect(_points, fineness, plane_pos, quat);
            }
            let sectors = [];
            for(let i1 = 0; i1 < slices.length; i1++) {
                let prev = slices[i1];
                let next = slices[posmod(i1 + 1, slices.length)];
                sectors[i1] = structuredClone(prev.plus).filter((point) => next.minus.some((_point) => compareobject(point, _point)));
                // if it's empty, try switching prev and next...
                for(let i2 = 0; i2 < prev.zero.length; i2++) {
                    sectors[i1][i2] = sectors[i1][i2].concat(structuredClone(prev.zero[i2]));
                }
                for(let i2 = 0; i2 < next.zero.length; i2++) {
                    sectors[i1][i2] = sectors[i1][i2].concat(structuredClone(next.zero[i2]));
                }
            }
            return sectors;
        },
        expand: function(points, bounds) {
        // changes the bounds of the shape by moving points and resizing
        // spheroids.
            let _points = structuredClone(points);
            let _bounds = AAX.Shape.bounds(_points);
            if(!bounds) {
                return [[[0, 0, 0]]]
            }
            else if(!_bounds || compareobject(_bounds, bounds)) {
                console.log("meep");
                return _points;
            };
            const letters = "lrudbf";
            let _center = [];
            let center = [];
            let multiply = [];
            let mirror = [];
            for(let i1 = 0; i1 < 3; i1++) {
                let neg = letters[2*i1];
                let pos = letters[2*i1 + 1];
                _center[i1] = (_bounds[neg] + _bounds[pos])/2;
                center[i1] = (bounds[neg] + bounds[pos])/2;
                // find the centers of both boxes
                let temp = _bounds[pos] - _bounds[neg];
                multiply[i1] = temp ? (bounds[pos] - bounds[neg])/temp : 1;
                // get multipliers by dividing whatever by
                // whatever
                mirror[i1] = multiply[i1] < 0;
            }
            if(!mirror.includes(false)) {
            // mirror is only used to know whether the quaternions should be
            // mirrored. and, since spheroids are symmetrical in all three
            // axes... mirroring the quaternion in all three axes would have the
            // exact same effect as not mirroring it at all.
                mirror = [false, false, false];
            };
            let all_same = multiply[0] === multiply[1] && multiply[1] === multiply[2];
            // endless, FINITE. (copy that.)
            // - ...these are just guilty gear lyrics, don't drive yourself
            //   crazy trying to interpret it.
            for(let i1 = 0; i1 < _points.length; i1++) {
                for(let i2 = 0; i2 < _points[i1].length; i2++) {
                    let point = _points[i1][i2];
                    if(point.length > 3 && !all_same) {
                    // if all the multipliers aren't the same, fill all missing
                    // dimensions.
                        point[4] ??= point[3];
                        point[5] ??= point[3];
                    };
                    for(let i3 = 0; i3 < 3; i3++) {
                        point[i3] = (point[i3] - _center[i3])*multiply[i3] + center[i3];
                        if(3 + i3 < point.length) {
                            point[3 + i3] *= Math.abs(multiply[i3]);
                        }
                    }
                    // for each point, subtract old box's center, scale, add new
                    // box's center
                    if(point.length >= 7) {
                        point[6] = Quat.mirror.multi(point[6], ...mirror);
                    }
                }
            }
            return _points;
        },
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
    frompoints: function(points) {
    // returns the smallest rectangle that would fit all the given points.
        if(!points.length) {
            return null;
        };
        let edges = [points[0][0], points[0][0], points[0][1], points[0][1]];
        for(let i1 = 1; i1 < points.length; i1++) {
            edges = [
                Math.min(edges[0], points[i1][0]),
                Math.max(edges[1], points[i1][0]),
                Math.min(edges[2], points[i1][1]),
                Math.max(edges[3], points[i1][1])
            ];
        }
        return Rect.fromedges(...edges);
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
    l: (rect) => Math.min(rect.x, rect.x + rect.w),
    r: (rect) => Math.max(rect.x, rect.x + rect.w),
    u: (rect) => Math.min(rect.y, rect.y + rect.h),
    d: (rect) => Math.max(rect.y, rect.y + rect.h),
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
    getcoor: (rect, index) => (
        (!Number.isInteger(index) || index < 0 || index >= rect.w*rect.h) ? null :
        [
            rect.x + index%rect.w,
            rect.y + Math.floor(index/rect.w)
        ]
    ),
    getindex: (rect, x, y) => (
        (
            x < rect.x || x >= rect.x + rect.w
            ||
            y < rect.y || y >= rect.y + rect.h
        ) ? -1 :
        rect.w*(Math.floor(y) - rect.y) + (Math.floor(x) - rect.x)
    ),
    // these are used when iterating for every pixel of a rectangle.
    // - each indexes represent one pixel of the rectangle, starting at the top
    //   left and going left to right for each row.
    // - getcoor converts indexes to coordinates, getindex converts coordinates
    //   to indexes
    // - getindex returns -1 if it's invalid or out of bounds, getcoor returns
    //   null.
    convertindex: function(rect1, rect2, index) {
        let coor = Rect.getcoor(rect1, index);
        return coor === null ? -1 : Rect.getindex(rect2, ...coor);
    },
    // a common operation. converts a rect1 index to a rect2 index.
    valid: (rect) => (
        rect
        &&
        typeof rect === "object"
        &&
        typeof rect.x === "number"
        &&
        typeof rect.y === "number"
        &&
        typeof rect.w === "number"
        &&
        typeof rect.h === "number"
    ),
    encloses: (rect1, rect2) => (
        Rect.l(rect2) >= Rect.l(rect1)
        &&
        Rect.r(rect2) <= Rect.r(rect1)
        &&
        Rect.u(rect2) >= Rect.u(rect1)
        &&
        Rect.d(rect2) <= Rect.d(rect1)
    ),
    // returns whether rect2 is entirely inside rect1.
    snap: (rect, x, y) => [
        rect.x + Math.floor((x - rect.x)/rect.w)*rect.w,
        rect.y + Math.floor((y - rect.y)/rect.h)*rect.h
    ],
    // treats the rect like a grid, and snaps the coordinates to it. i'm not
    // sure if it works with negative dimensions rects.
    overlap: function(rect1, rect2) {
    // returns a rect of the two inputted rects' overlap. (or null if they don't
    // overlap.)
        let edge1 = Rect.edges(rect1);
        let edge2 = Rect.edges(rect2);
        let edge = [
            Math.max(edge1[0], edge2[0]),
            Math.min(edge1[1], edge2[1]),
            Math.max(edge1[2], edge2[2]),
            Math.min(edge1[3], edge2[3])
        ];
        return (edge[1] < edge[0] || edge[3] < edge[2]) ? null : Rect.fromedges(...edge);
    },
    border: function(rect) {
    // returns an array of 2d points for each pixel of the border.
    // - inward pixels, that is. so, if it has 0 w or 0 h, it's empty.
    // - used for PixelArt's select border.
        let border = [];
        let x_sign = Math.sign(rect.w);
        let y_sign = Math.sign(rect.h);
        if(!x_sign || !y_sign) {
            return border;
        }
        let start = [
            rect.x - (x_sign === -1),
            rect.y - (y_sign === -1)
        ];
        let end = [
            rect.x + rect.w - (x_sign !== -1),
            rect.y + rect.h - (y_sign !== -1)
        ];
        let cursor = structuredClone(start);
        while(x_sign && Math.sign(end[0] - cursor[0]) === x_sign) {
            border.push(structuredClone(cursor));
            cursor[0] += x_sign;
        }
        while(y_sign && Math.sign(end[1] - cursor[1]) === y_sign) {
            border.push(structuredClone(cursor));
            cursor[1] += y_sign;
        }
        while(x_sign && Math.sign(start[0] - cursor[0]) === -x_sign) {
            border.push(structuredClone(cursor));
            cursor[0] -= x_sign;
        }
        while(y_sign && Math.sign(start[1] - cursor[1]) === -y_sign) {
            border.push(structuredClone(cursor));
            cursor[1] -= y_sign;
        }
        return border;
    },
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
            "<br><label><input type=\"checkbox\" name=\"birth allowed\" checked> birth</label>",
            "<label><input type=\"checkbox\" name=\"death allowed\" checked> death</label>",
            "<label><input type=\"checkbox\" name=\"invert\"> invert</label>",
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
            "<details class=\"text\">\n\t<summary>script system</summary>\n\t" + arraytoul([
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
            "<details class=\"text\">\n\t<summary>exception system</summary>\n\t" + arraytoul([
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
            " " + [
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
                " " + [
                    "move -2",
            		"birth",
            		"birth 1 1 -2",
            		"birth 1 1 0 3",
            		"move -3 4",
            		"birth 1 -4",
            		"birth 3 1"
                ].join("\n  ")
            ].join("\n ")
        ].join("\n");
        this.html.scripting.onkeydown = textarea_tab;
        let buttons = container.querySelectorAll("button");
        for(i1 = 0; i1 < buttons.length; i1++) {
            this.html[buttons[i1].name.replaceAll(" ", "_")] = buttons[i1];
        }
        //
        this._w = 128;
        this._h = 128;
        let canvas = this.html.canvas;
        this.ctx = canvas.getContext("2d");
        canvas.style = "image-rendering: crisp-edges; touch-action: pinch-zoom";
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
        /*
        function subscript(script, index) {
            let _script = [];
            for(let i1 = index + 1; i1 < script.length && script[i1].startsWith("\t"); i1++) {
                _script.push(script[i1].slice("\t".length));
            }
            return _script;
        }
        //*/
        function subscript(script, index) {
            let _script = [];
            let parent = script[index].length - script[index].trimStart().length;
            let lowest = null;
            for(let i1 = index + 1; i1 < script.length; i1++) {
                let indent = script[i1].length - script[i1].trimStart().length;
                if(indent > parent) {
                    if(lowest === null || indent < lowest) {
                        lowest = indent;
                    };
                    _script.push(script[i1]);
                }
                else {
                    i1 += script.length;
                }
            }
            lowest ??= parent;
            for(let i1 = 0; i1 < _script.length; i1++) {
                _script[i1] = _script[i1].slice(lowest);
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
        const invert = this.html.invert.checked;
        for(let i1 = 0; i1 < values.length; i1++) {
            let x = i1%w;
            let y = Math.floor(i1/w);
            let index = 0;
            for(let i2 = 0; i2 < 8; i2++) {
                let _x = x + Number(posmod(i2 - 7, 8) < 3) - Number(posmod(i2 - 3, 8) < 3);
                let _y = y + Number(posmod(i2 - 1, 8) < 3) - Number(posmod(i2 - 5, 8) < 3);
                if(invertboolean(values[posmod(_y, h)*w + posmod(_x, w)], invert)) {
                    index += 2**i2;
                };
            }
            // refer to the comments under get_rules for how birth/survive
            // indexes work.
            let birth = this.birth.every[index];
            let survive = this.survive.every[index];
            _values.push(
                values[i1]
                ?
                (((invert ? !birth : survive) || !death_allowed) ? values[i1] : 0)
                :
                (((invert ? !survive : birth) && birth_allowed) ? 1 : 0)
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
function paste(ctx, copydata, x, y) {
// copydata: data returned by copy().
    let styletemp = ctx.fillStyle;
    let _rect = Rect.new(x, y, copydata.w, copydata.h);
    // rectangle you're trying to put the image on
    let rect = Rect.overlap(_rect, Rect.new(0, 0, ctx.canvas.width, ctx.canvas.height));
    if(!rect || !rect.w || !rect.h) {
    // entirely out of bounds
        return;
    }
    let imagedata = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    // rectangle of what's actually in the canvas
    for(let i1 = 0; i1 < rect.w*rect.h; i1++) {
        let coor = Rect.getcoor(rect, i1);
        let color = new Uint8ClampedArray(copydata[ Rect.getindex(_rect, ...coor) ]);
        if(color[3] !== 0) {
            if(color[3] !== 255) {
                let under = imagedata.data.slice(i1*4, (i1 + 1)*4);
                for(let i2 = 0; i2 < 3; i2++) {
                    const temp = under[i2] + Math.round((color[i2] - under[i2])*color[3]/255);
                    //console.log(under[i2] - temp);
                    color[i2] = temp;
                    //rgb = rgb1 + (rgb2 - rgb1)*alpha2;
                }
                color[3] = 255 - ((255 - under[3]) * (255 - color[3])/255);
                //alpha = 255 - ((255 - color1) * (255 - color2)/255);
            };
            ctx.fillStyle = "rgba(" + color.slice(0, 3) + "," + color[3]/255 + ")";
            ctx.clearRect(...coor, 1, 1);
            ctx.fillRect(...coor, 1, 1);
        };
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
function colortohex(ctx, color, compress) {
// - compress: if true, it'll return 3 or four digit codes instead, by rounding
//   values to the nearest 17.
//   - in css, a color like #07F7 acts as shorthand for #0077FF77.
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
            if(compress) {
                num = Math.round(num/17)*17;
            };
            //
            if(i1 !== 3 || num !== 255) {
                num = numtohex(num, 2);
                value += compress ? num[0] : num;
            }
        }
    }
    else if(compress) {
        let _value = value;
        value = "#";
        for(let i1 = 1; i1 < _value.length; i1 += 2) {
            let num = Math.round(parseInt(_value.slice(i1, i1 + 2), 16)/17);
            value += "0123456789abcdef"[num];
        };
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
    button.style.color = "white";
    button.style.textShadow = "1px 0px 1px black, 0px 1px 1px black, -1px 0px 1px black, 0px -1px 1px black";
    button.style.border = "thin solid " + _color;
    button.style.borderRadius = "8px";
}

class PixelArt {
// class that creates and operates a pixel art tool.
// - probably the most confusing thing is the frame system. read this so you
//   don't get lost.
//   - this.canvas: the drawing area. this doesn't exist anywhere on the page,
//     it's created with document.createElement. this is where the image is
//     stored and edited.
//   - this.html.frame: the canvas that shows the drawing area. part of it,
//     anyway.
//   - there's three sliders that change where the frame shows and how big it
//     is: this.html frame_x, frame_y, and frame_size.
//   - this frame_w_inc and frame_h_inc: how many pixels each increment of the
//     frame_size slider changes the frame dimensions by.
//   - this.frame_rect: rectangle getter.
    constructor(container, prefix, viewport_size, frame_w_inc, frame_h_inc) {
    // - container: div that will be turned into the pixel art tool.
    // - prefix: used for certain global level things. this is usually only
    //   needed if there's multiple PixelArts used in the same page.
    //   - you see, for it to make radio buttons for the different tools, those
    //     tools have to share the same name...
    //   - by default, that name is "px_tool". prefix + "_tool".
    //   - but maybe that conflicts with something. particularly, another
    //     PixelArt with the same prefix?
    //   - so, you can set this as something that won't cause conflicts.
        let i1 = 0;
        let i2 = 0;
        //verticalscreen = true;
        this.prefix = typeof prefix === "string" ? prefix : "px";
        this.frame_w_inc = (Number.isInteger(frame_w_inc) && frame_w_inc > 0) ? frame_w_inc : 4;
        this.frame_h_inc = (Number.isInteger(frame_h_inc) && frame_h_inc > 0) ? frame_h_inc : 4;
        this.viewport_size = (Number.isInteger(viewport_size) && viewport_size > 0) ? viewport_size : 256/4;
        let viewport_w = this.viewport_size*this.frame_w_inc;
        let viewport_h = this.viewport_size*this.frame_h_inc;
        if(!(container instanceof HTMLElement)) {
            console.log("invalid input. you must give an html container for everything to go inside.");
            return;
        };
        this.html = {};
        this.html.container = container;
        let today = new Date();
        today = datestring(today.getFullYear(), today.getMonth(), today.getDate());
        let manual = arraytoul([
            "most of this tool is pretty self-explanatory, but there's a few confusing bits, and hidden information...",
            "forecolor is the color tools like pen and line draw in.",
            "backcolor is used for erasing, and treated like transparency for things like copy and pasting.",
            "palette",
            [
                "all the colors you can draw with are stored in the palette, the image to the left of the viewport.",
                "with the buttons to the left of it, you can add colors, delete colors, set forecolor/backcolor as them, etc.",
                "click a color on the palette to select it, so that's the color the color buttons affect.",
                "click the color you already have selected to set it as the forecolor.",
                "the \"save palette\" button saves the palette as an image. both the file name and the image show the color codes of the palette's colors, so you can load the palette later by copying the file name and entering it into the \"add colors\" button."
            ],
            "viewport",
            [
                "there's three scrollbars near the viewport.",
                "the bottom scrollbar controls how much of the image the viewport shows. at the max value, it shows the whole thing.",
                "the other two control which part of the image it shows.",
                "dotted borders show up when it's at the edge of the image.",
                "the \"viewport hue\" slider near the color buttons controls the color shown below the canvas. by messing with it, you can tell what pixels are transparent."
            ],
            "keyboard shortcuts",
            [
                "ctrl+z, ctrl+shift+z: undo, redo",
                "ctrl+s, ctrl+o: save, load",
                "ctrl+x, ctrl+c, ctrl+v: cut, copy, paste",
                "w, a, s, d, q, e: controls the three viewport sliders.",
            ],
            //*
            "grid",
            [
                "by making a selection and clicking the \"set as grid\" button, you can set that selection as the new grid.",
                "the grid is not shown visually. it's only used in certain tools and buttons.",
                [
                    "\"grid select\" tool",
                    "\"shift by grid\" buttons",
                    "the move and paste tools' \"snap to grid\" checkbox"
                ],
                "it's useful for avoiding small inaccuracies, like when you're trying to select animation frames."
            ],
            //*/
            "color ramp",
            [
                "draws two colors, and the colors between them.",
                "as for entering the colors, the same rules as the color replace button apply here. you can use numbers to indicate colors in the palette, and leaving it empty makes it use forecolor/backcolor. (forecolor for start, backcolor for end.)"
            ],
            "animation test",
            [
                "used for testing spritesheets.",
                "to use this tool, you have to select something. select the first frame of your animation.",
                "the second frame should be a rectangle of equal dimensions to the right of it, the third frame is another rectangle to the right of that, etc.",
                "unless \"vertical\" is on. then it moves down instead of right.",
                "\"wrap\" is how many frames there are in a row before it moves on to the next row. (or, if vertical is on, how many frames in a column before it goes to the next column.) if wrap is 0, it assumes all the frames are in one row.",
                "while this tool is selected, the viewport is used to show the animation. clicking the viewport will pause or play it.",
                "number of frames, fps, and loop are all pretty obvious.",
                "the arrow buttons move to the previous or next frame."
            ],
            "misc",
            [
                "there's a few buttons that explain themselves in the prompts they give you.",
                "the color picker can be held down. while it's held, you can see how it'll change the forecolor/backcolor or the palette, but that change is only finalized when you release it. this way, if you're trying to get the color of something really small, you can be more precise by carefully moving your click until you see the color you want.",
                "the \"spread diagonally\" checkbox of the bucket fill tool is useful for coloring outlines."
            ]
        ]);
        let dither_menu = [];
        for(i1 in dithers) {
            if(dithers.hasOwnProperty(i1)) {
                dither_menu.push("<option value=\"" + i1 + "\">" + i1 + "</option>");
            }
        }
        //grid-template-columns: repeat(6, 1fr);
        //style=\"grid-column: span 2\"
        let tool_settings = [
            "<label><input type=\"number\" name=\"pen r\" value=0 style=\"width: 4em\"> radius</label>",
            "<label><input type=\"number\" name=\"eraser r\" value=2 style=\"width: 4em\"> radius</label>",
            "<br class=\"eraser\"><label><input type=\"checkbox\" name=\"eraser mask\"> create transparency</label>",
            "<label><input type=\"number\" name=\"dither r\" value=4 style=\"width: 4em\"> radius</label>",
            //"<div name=\"dither div\" style=\"display: inline flow\">",
            "<br class=\"dither\"><select name=\"dither type\">\n\t\t" + dither_menu.join("\n\t\t") + "\n\t</select>",
            "<label><input type=\"checkbox\" name=\"dither invert\"> invert</label>",
            //"</div>",
            "<br class=\"dither\"><label><input type=\"checkbox\" name=\"dither back\"> draw on backcolor only</label>",
            "<label><input type=\"checkbox\" name=\"bucket diagonal\"> spread diagonally</label>",
            "<br class=\"bucket\"><label><input type=\"checkbox\" name=\"bucket mask\"> create transparency</label>",
            "<label><input type=\"checkbox\" name=\"shape fill\"> fill</label>",
            "<label>text: <input type=\"text\" name=\"text text\" value=\"" + today + "\"></label>",
            "<label><input type=\"string\" name=\"ramp start\" style=\"width: 8em\"> start color</label>",
            "<br class=\"ramp\"><label><input type=\"string\" name=\"ramp end\" style=\"width: 8em\"> end color</label>",
            "<br class=\"ramp\"><label><input type=\"number\" name=\"ramp number\" style=\"width: 3em\" value=3 step=1 min=0> number of betweens</label>",
            "<br class=\"ramp\"><label><input type=\"number\" name=\"ramp size\" style=\"width: 3em\" value=2 step=1 min=1> size</label>",
            "<br class=\"ramp\"><label><input type=\"checkbox\" name=\"ramp vertical\"> vertical</label>",
            "<label><input type=\"checkbox\" name=\"select move snap\"> snap to grid</label>",
            "<label><input type=\"number\" name=\"anim duration\" style=\"width: 3em\" value=1 step=1 min=1> number of frames</label>",
            "<br class=\"anim\"><label><input type=\"number\" name=\"anim wrap\" style=\"width: 3em\" value=0 step=1 min=0> wrap</label>",
            "<br class=\"anim\"><label><input type=\"checkbox\" name=\"anim vertical\"> vertical</label>",
            "<br class=\"anim\"><label><input type=\"checkbox\" name=\"anim loop\" checked> loop</label>",
            "<br class=\"anim\"><label><input type=\"number\" name=\"anim fps\" style=\"width: 3em\" value=12 step=1 min=1> frames per second</label>",
            "<br class=\"anim\"><button name=\"anim prev\">&#160;&#60;&#160;</button>",
            "<button name=\"anim next\">&#160;&#62;&#160;</button>",
            "<label>script:",
            "<br class=\"fx\"><textarea name=\"fx script\" style=\"width: 100%\"></textarea>",
            "</label>",
            "<br class=\"fx\"><button name=\"fx execute\">execute</button>",
            "<br class=\"fx\"><label><input type=\"number\" name=\"fx scale\" style=\"width: 3em\" value=1> scale</label>",
            "<br class=\"fx\"><label><input type=\"text\" name=\"fx offset\" style=\"width: 9em\" value=\"0, 0\"> offset</label>",
            "<label><input type=\"checkbox\" name=\"paste snap\"> snap to grid</label>",
        ];
        // tool settings elements
        let temp = null;
        tool_settings = [
            "<" + (verticalscreen ? "td colspan=2" : "div") + " name=\"tool settings\" style=\"vertical-align: top; padding: 8px; " + (verticalscreen ? "font-size: 0.8em" : "background-color: #FFF5; overflow-y: scroll; width: 20em; height: 5em; border: solid 1px black") + "\">",
            "\t" + tool_settings.join("\n\t"),
            "</" + (verticalscreen ? "td" : "div") + ">"
        ].join("\n");
        let tool_area = [];
        if(!verticalscreen) {
            tool_area.push(tool_settings.replaceAll("\n", "\n\t"));
        };
        for(i1 = 0; i1 < PixelArt.valid.tools.length; i1++) {
            let _i1 = PixelArt.valid.tools[i1];
            let __i1 = (
                _i1 === "colorpick" ? "color picker" :
                _i1 === "bucket" ? "bucket fill" :
                _i1 === "rectangle" ? "box" :
                _i1 === "ramp" ? "color ramp" :
                _i1 === "anim" ? "animation test" :
                _i1.startsWith("select ") ? _i1.replace("select ", "") :
                _i1
            );
            let hidden = _i1 === "select scale" || _i1 === "fx";
            let line = "<label" + (hidden ? " hidden" : "") + "><input type=\"radio\" name=\"" + this.prefix + "_tool\" value=\"" + _i1 + "\"" + ((_i1.startsWith("select ") || _i1 === "paste") ? " disabled" : "") + "> " + __i1 + "</label>";
            if(_i1 === "colorpick") {
                line += " <button name=\"colorpick type\">" + PixelArt.valid.colorpick_type[0] + "</button>";
            }
            else if(_i1 === "select") {
                line += " <button name=\"deselect\" disabled>deselect</button>";
            };
            // these are too important to hide away in the box.
            if((verticalscreen ? i1 : true) && _i1 !== "rectangle" && _i1 !== "ellipse" && !hidden) {
                line = "<br>" + line;
            };
            tool_area.push(line);
        }
        // tool menu complete
        tool_area = [
            "tools:<ul style=\"font-size: 0.8em\">\n\t" + tool_area.join("\n\t") + "</ul>",
            "selection actions:<ul name=\"selection actions\" style=\"font-size: 0.8em\">\n\t" + [
                "<button name=\"cut\">cut</button> <button name=\"copy\">copy</button>",
                //"<button name=\"set as grid\">set as grid</button>",
                [
                    "<button name=\"swap l\" style=\"font-family: inherit\">l</button>",
                    "<button name=\"swap r\" style=\"font-family: inherit\">r</button>",
                    "<button name=\"swap u\" style=\"font-family: inherit\">u</button>",
                    "<button name=\"swap d\" style=\"font-family: inherit\">d</button>"
                ].join("") + " swap",
                [
                    "<button name=\"shift l\" style=\"font-family: inherit\">l</button>",
                    "<button name=\"shift r\" style=\"font-family: inherit\">r</button>",
                    "<button name=\"shift u\" style=\"font-family: inherit\">u</button>",
                    "<button name=\"shift d\" style=\"font-family: inherit\">d</button>"
                ].join("") + " shift",
                [
                    "<button name=\"grid shift l\" style=\"font-family: inherit\">l</button>",
                    "<button name=\"grid shift r\" style=\"font-family: inherit\">r</button>",
                    "<button name=\"grid shift u\" style=\"font-family: inherit\">u</button>",
                    "<button name=\"grid shift d\" style=\"font-family: inherit\">d</button>"
                ].join("") + " shift by grid",
                (
                    "<button name=\"x mirror\" style=\"font-family: inherit\">x</button>" +
                    "<button name=\"y mirror\" style=\"font-family: inherit\">y</button>" +
                    " mirror"
                ),
                (
                    "<button name=\"rotate 90\" style=\"font-family: inherit\">&#160;90</button>" +
                    "<button name=\"rotate 180\" style=\"font-family: inherit\">180</button>" +
                    "<button name=\"rotate 270\" style=\"font-family: inherit\">270</button>" +
                    " rotate"
                ),
                "<button name=\"color replace\">replace color</button>",
                "<button name=\"color add\">add colors to palette</button>",
                "<button name=\"outline\">add outline</button> <label><input type=\"checkbox\" name=\"outline diagonals\"> diagonals</label>"
            ].join("\n\t<br>") + "</ul>"
        ].join("\n");
        // include actions too
        let text = [
            "<tr style=\"height: " + viewport_h + "px\">",
            "<td style=\"display: inline-grid; grid-template-columns: repeat(6, 1fr); width: 192px; height: " + viewport_h + "px\">",
            "<button name=\"palette add\" style=\"grid-column: span 2\">add color</button>",
            "<button name=\"palette edit\" style=\"grid-column: span 2\">edit color</button>",
            "<button name=\"palette delete\" style=\"grid-column: span 2\">delete color</button>",
            "<button name=\"palette up\" style=\"grid-column: span 3\">shift up</button>",
            "<button name=\"palette down\" style=\"grid-column: span 3\">shift down</button>",
            "<button name=\"palette save\" style=\"grid-column: span 3\">save palette</button>",
            "<button name=\"palette clear\" style=\"grid-column: span 3\">clear palette</button>",
            "<button name=\"palette forecolor\" style=\"grid-column: span 3\">set as forecolor</button>",
            "<button name=\"palette backcolor\" style=\"grid-column: span 3\">set as backcolor</button>",
            //"<button name=\"palette viewport\" style=\"grid-column: span 6\">set as viewport color</button>",
            "<button name=\"forecolor\" style=\"grid-column: span 3; font-family: inherit\"></button>",
            "<button name=\"backcolor\" style=\"grid-column: span 3; font-family: inherit\"></button>",
            "<button name=\"color switch\" style=\"grid-column: span 6\">color switch</button>",
            "</td>",
            // ui related to colors and palettes
            "<td><canvas name=\"palette\" style=\"image-rendering: crisp-edges\"></canvas></td>",
            // to the right of it, the palette canvas
            // place-items: center; align-items: center; justify-content: center;
            "<td><div name=\"viewport\" style=\"display: block; width: " + viewport_w + "px; height: " + viewport_h + "px; background-color: orange\">",
            // viewport
            // - give it rigid dimensions
            // - use scroll bars if the insides get bigger than that
            // - center the canvas (no idea how it takes three properties to do
            //   that, but whatever.)
            // - add a dashed border
            "<canvas name=\"frame\" style=\"image-rendering: crisp-edges; touch-action: pinch-zoom; width: 100%; height: 100%\"></canvas>",
            // frame canvas
            // - no anti-aliasing
            // - touching it on mobile shouldn't drag around the page
            // - take up the whole viewport.
            "</div></td>",
            "<td style=\"display: inline grid\"><input type=\"range\" name=\"frame y\" style=\"writing-mode: vertical-lr; height: " + viewport_h + "px\" value=0 step=1 min=0></td>",
            (verticalscreen ? "" : "\n<td rowspan=2 style=\"height: " + viewport_h + "px; vertical-align: top; overflow: scroll\">\n" + tool_area + "\n</td>"),
            "</tr>",
            "<tr>",
            "<td colspan=2 style=\"vertical-align: top\">",
            "<label style=\"grid-column: span 6; font-size: 0.8em\"><input type=\"range\" name=\"palette viewport\" style=\"width: 100%\" value=30 step=5 min=0 max=360><br>viewport hue</label>",
            "</td>",
            "<td colspan=2 style=\"vertical-align: top\">",
            "<input type=\"range\" name=\"frame x\" style=\"width: " + viewport_w + "px\" value=0 step=1 min=0>",
            "<br><input type=\"range\" name=\"frame size\" style=\"width: " + viewport_w + "px\" value=1 step=1 min=1>",
            "<br><small name=\"dimension text\"></small>",
            "<br>" + [
                "<button name=\"undo\">undo</button>",
                "<button name=\"redo\">redo</button>",
                "<button name=\"save\">save</button>",
                "<button name=\"load\">load</button>",
            ].join(" "),
            "<br><button name=\"canvas size\">change canvas size</button>",
            "<br><label style=\"font-size: 0.8em\"><input type=\"number\" name=\"grid inc\" style=\"width: 4em\" value=8 min=1> grid increment</label>",
            "</td>",
            "</tr>"
        ];
        if(verticalscreen) {
            text = text.concat([
                "<tr>",
                tool_settings,
                "<td colspan=2 style=\"vertical-align: top\">",
                tool_area,
                "</td>",
                "</tr>"
            ]);
        };
        text = [
            "<details class=\"text\">",
            "<summary>manual</summary>",
            manual,
            "</details>",
            "<table>",
            text.join("\n"),
            "</table>"
        ].join("\n");
        container.innerHTML += text;
        this.canvas = document.createElement("canvas");
        this.canvas.width = 64;
        this.canvas.height = 64;
        //this.html.frame = container.querySelectorAll("canvas")[1];
        //this.html.viewport = this.html.frame.parentElement;
        let _this = this;
        function addtohtml(element) {
            let list = element.children;
            for(let i1 = 0; i1 < list.length; i1++) {
                let ref = list[i1];
                let type = ref.tagName.toLowerCase();
                //console.log(ref);
                let name = (
                    ref.name
                    ??
                    (
                        "name" in ref.attributes ? ref.attributes.name.value :
                        ("name" in ref && ref.name) ? ref.name :
                        type === "button" ? ref.innerHTML :
                        ""
                    )
                );
                name = name.replaceAll(" ", "_");
                if(name) {
                    //console.log(name);
                    _this.html[name] = list[i1];
                };
                addtohtml(list[i1]);
            }
        }
        addtohtml(container);
        //
        this.html.colorpick_type.onclick = function(e) {
            let values = PixelArt.valid.colorpick_type;
            e.target.innerText = values[(values.indexOf(e.target.innerText) + 1)%values.length];
            _this.tool = "colorpick";
        }
        // this makes the button act like a radio button or dropdown, pretty
        // much. clicking it makes the text cycle through the strings in that
        // array, and the current text of the button is used to get what "mode"
        // is currently selected.
        this.html.palette_add.onclick = function(e) {
            let input = trimunspecial(prompt("enter a new color to add to the palette. you can add multiple colors by separating them with spaces. (it's fine to use commas and stuff though.)") ?? "");
            if(!input) {
                return;
            }
            let add = Color.split(input);
            for(let i1 = 0; i1 < add.length; i1++) {
                let color = add[i1];
                if(color) {
                    color = colortohex(_this.ctx, color);
                    //_this.remove_color(color);
                    _this.palette.push(color);
                };
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
            let palette = [];
            for(let i1 = 0; i1 < _this.palette.length; i1++) {
                let color = _this.palette[i1];
                if(color.startsWith("#") && (color.length === 7 || color.length === 9)) {
                // if applicable, compress into 3 or 4 digits to keep the file
                // name short. (ex: #0077ff22 => #07f2)
                    let _color = "#";
                    for(let i2 = 1; i2 < color.length; i2 += 2) {
                        _color = (color[i2] === color[i2 + 1]) ? (_color + color[i2]) : "";
                    }
                    if(_color) {
                        color = _color;
                    }
                };
                palette.push(color);
            }
            savecanvas(_this.html.palette, palette.join(" ") + ".png");
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
        //this.html.palette_viewport.onclick = function(e) {
        //    _this.html.viewport.style.backgroundColor = _this.palette[_this.palette_index];
        //}
        this.html.palette_viewport.oninput = function(e) {
            let hue = posmod(Number(_this.html.palette_viewport.value), 360);
            _this.html.viewport.style.backgroundColor = "hsl(" + hue + ", 50%, 50%)";
        }
        this.html.palette_viewport.onchange = function(e) { document.documentElement.focus() };
        this.html.forecolor.onclick = function(e) {
            let color = (prompt("enter a new forecolor.") ?? "").trim();
            if(!color) {
                return;
            }
            color = colortohex(_this.ctx, color);
            _this.forecolor = color;
        }
        this.html.backcolor.onclick = function(e) {
            let color = (prompt("enter a new backcolor.") ?? "").trim();
            if(!color) {
                return;
            }
            color = colortohex(_this.ctx, color);
            _this.backcolor = color;
        }
        this.html.color_switch.onclick = function(e) {
            let temp = _this.backcolor;
            _this.backcolor = _this.forecolor;
            _this.forecolor = temp;
        }
        //
        this.html.canvas_size.onclick = function(e) {
            let i1 = 0;
            let dim = [_this.canvas.width, _this.canvas.height];
            let input = prompt([
                "enter a letter for which side to expand or trim, and a number for how it should be affected. for example...",
                "\"u +30\": expands the top by 30 pixels.",
                "\"d -20\": trims the bottom by 20 pixels.",
                "\"r 128\": trims or expands the right side so that the canvas is 128 pixels wide.",
                "current size: " + dim.join(", ")
            ].join("\n\n")) ?? "";
            const sides = "lrud";
            const valid = sides + " -+1234567890";
            for(i1 = 0; i1 < input.length; i1++) {
                if(!valid.includes(input[i1])) {
                // just in case they assume they need to use commas or
                // something. i don't want that to screw it up. especially since
                // my explanation wasn't very clear.
                    input = input.slice(0, i1) + " " + input.slice(i1 + 1);
                }
            }
            input = trimunspecial(input);
            if(!input) {
                return;
            }
            input = input.split(" ");
            let ctx = _this.ctx;
            let image = _this.states.current.image;
            let newstate = false;
            for(i1 = 0; i1 < input.length - 1; i1++) {
                let side = sides.indexOf(input[i1]);
                if(side !== -1 && input[i1].length === 1) {
                    let axis = Math.floor(side/2);
                    i1++;
                    let num = input[i1];
                    num = (
                        num.startsWith("-") ? Number(num) :
                        num.startsWith("+") ? Number(num.slice(1)) :
                        Number(num) - dim[axis]
                    );
                    if(Number.isInteger(num) && num && (dim[axis] + num) > 0) {
                        newstate = true;
                        if(!(side%2)) {
                        // move select and grid
                            if(_this.select) {
                                _this.select["xy"[axis]] += num;
                            };
                            //_this.grid["xy"[axis]] += num;
                        };
                        _this.canvas[axis ? "height" : "width"] += num;
                        let _dim = structuredClone(dim);
                        dim[axis] += num;
                        ctx.clearRect(0, 0, ...dim);
                        let x = side === 0 ? num : 0;
                        let y = side === 2 ? num : 0;
                        if(num > 0) {
                            ctx.fillStyle = _this.backcolor;
                            ctx.fillRect(0, 0, ...dim);
                            ctx.clearRect(x, y, ..._dim);
                        };
                        ctx.putImageData(image, x, y);
                        image = ctx.getImageData(0, 0, ...dim);
                        if(_this.select && !Rect.encloses(Rect.new(0, 0, ...dim), _this.select)) {
                            _this.select = Rect.overlap(Rect.new(0, 0, ...dim), _this.select);
                        };
                    }
                }
            }
            if(newstate) {
                _this.update_frame_scroll();
                _this.refresh();
            };
            // save
        }
        //
        this.html.frame.onpointerdown = function(e) { _this.mousedown(e, _this) };
        this.html.frame.onpointermove = function(e) { _this.mousemove(e, _this) };
        this.html.frame.onpointerup = function(e) { _this.mouseup(e, _this) };
        this.frame_ctx = this.html.frame.getContext("2d");
        this.ctx = this.canvas.getContext("2d");
        let w = this.canvas.width;
        let h = this.canvas.height;
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, w, h);
        /*
        for(i1 = 0; i1 < w; i1++) {
            for(i2 = 0; i2 < h; i2++) {
                let dist = 2*Math.min(i1, w - i1, i2, h - i2)/Math.max(w, h);
                this.ctx.fillStyle = "rgb(255, " + Math.round(255*dist) + ", 0)";
                this.ctx.fillRect(i1, i2, 1, 1);
            }
        }
        //*/
        /*
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
        //*/
        this.tool = PixelArt.valid.tools[0];
        this._select = null;
        // the selected area. either null, or a rectangle.
        // - this does NOT get absolute-valued.
        // - this is part of a getter/setter thing, so DO NOT set individual
        //   numbers.
        // - rectangles with zero w or zero h are invalid. it'll save/return
        //   null if you try that.
        this.select_border = [];
        // the border pixels, used when drawing it in refresh. updated in the
        // select setter.
        this.select_ticktock = false;
        // boolean used to alternate between inverting one half of the border
        // and the other when animating it
        this._anim_frame = 0;
        this._anim_playing = false;
        this.anim_interval = null;
        //
        this._forecolor = null;
        this._backcolor = null;
        this.forecolor = "black";
        this.backcolor = "white";
        // pen color, eraser color
        // - i don't think i need to initialize the underscored versions but
        //   whatever.
        // - this runs the setters, which set the style and text of the buttons
        this.filename = this.prefix + " " + filedate();
        // used when saving. if the user ignores the filename prompt, it uses
        // this. (loading a file makes this take its name.)
        this._copydata = null;
        // used in copy/paste. another getter/setter pair.
        this.palette = ["#000000", "#ffffff"].concat(Color.random(14, true, true));
        for(i1 = 2; i1 < this.palette.length; i1++) {
            let compressed = colortohex(this.ctx, this.palette[i1], true);
            //console.log(compressed);
            this.palette[i1] = "#";
            for(i2 = 1; i2 < compressed.length; i2++) {
                this.palette[i1] += compressed[i2].repeat(2);
            }
        }
        this.palette_index = 0;
        // palette, and which color is selected for button stuff. NOTE: palette
        // colors must ALWAYS be in hexadecimal form. (6 digits, or 8 digits.)
        //
        this.palette_ctx = this.html.palette.getContext("2d");
        this.refresh_palette();
        this.html.palette.onclick = function(e) {
            let click = clickxy(e);
            let col = _this.palette_col(_this);
            let cell_w = PixelArt.palette_cell_w;
            let cell_h = PixelArt.palette_cell_h;
            let index = col*Math.floor(click[0]/cell_w) + col - 1 - Math.floor(click[1]/cell_h);
            if(index === _this.palette_index) {
                _this.forecolor = _this.palette[_this.palette_index];
            }
            else if(index < _this.palette.length) {
                _this.palette_index = index;
                _this.refresh_palette();
            }
        }
        //
        this.stroke = null;
        // data stored during a stroke
        temp = document.getElementsByName(this.prefix + "_tool");
    	for(let i1 in temp) {
    		if(temp.hasOwnProperty(i1)) {
                if(temp[i1].value === this.tool) {
                    temp[i1].checked = true;
                };
    			temp[i1].onchange = function(e) {
    				if(e.target.checked) {
                        _this.tool = e.target.value;
    				};
    			}
    		}
    	}
        //
        this.states = new States(
            _this, 32,
            function(tool) {
                return {
                    image: tool.ctx.getImageData(0, 0, tool.canvas.width, tool.canvas.height),
                    select: structuredClone(tool.select),
                };
            },
            function(tool, state) {
                tool.canvas.width = state.image.width;
                tool.canvas.height = state.image.height;
                tool.ctx.clearRect(0, 0, state.image.width, state.image.height);
                tool.ctx.putImageData(state.image, 0, 0);
                tool.select = structuredClone(state.select);
                tool.refresh("states");
            }
        );
        this.update_frame_scroll();
        this.html.frame_size.value = this.html.frame_size.max;
        this.update_frame_scroll();
        // set the maximum of the frame x/y sliders.
        this.refresh("states");
        // initialize the frame image.
        this.select = null;
        // - run the setter, so selection actions get disabled.
        //
        this.html.anim_fps.onclick = function(e) {
            if(_this.anim_playing) {
            // reset the interval
                _this.anim_playing = false;
                _this.anim_playing = true;
            };
        };
        this.html.anim_prev.onclick = function(e) {
            _this.anim_frame--;
        };
        this.html.anim_next.onclick = function(e) {
            _this.anim_frame++;
        };
        this.html.anim_duration.oninput = function(e) {
            if(_this.anim_frame >= _this.frame_duration) {
                _this.anim_frame = 0;
            };
        };
        this.html.anim_wrap.oninput = function(e) { _this.refresh("states") };
        this.html.anim_vertical.oninput = function(e) { _this.refresh("states") };
        // all of the animation-related code relies on getters/setters a lot.
        // for a lot of these, a refresh isn't necessary because it already
        // happens in the setter.
        // - wrap and vertical change where the frames are, so they're a
        //   different story.
        textarea_autosize(this.html.fx_script);
        this.html.fx_script.onkeydown = textarea_autosize;
        this.html.fx_execute.onclick = function(e) {
            let scale = readnumber(_this.html.fx_scale.value) ?? 1;
            if(!scale) {
                return;
            };
            let offset = _this.fx_offset;
        };
        //
        this.html.frame_x.oninput = function(e) { _this.refresh("states") };
        this.html.frame_y.oninput = function(e) { _this.refresh("states") };
        this.html.frame_size.oninput = function(e) {
            _this.update_frame_scroll();
            _this.refresh("states");
        };
        // show the changes frame x/y/size causes
        this.html.frame_x.onchange = function(e) { document.documentElement.focus() };
        this.html.frame_y.onchange = function(e) { document.documentElement.focus() };
        this.html.frame_size.onchange = function(e) { document.documentElement.focus() };
        this.html.frame_x.style["touch-action"] = "pinch-zoom";
        this.html.frame_y.style["touch-action"] = "pinch-zoom";
        this.html.frame_size.style["touch-action"] = "pinch-zoom";
        // for some awful reason, when a slider is the activeElement, it's
        // impossible to do anything with the keyboard except change the value
        // of that slider with the arrow keys. so unless i focus on something
        // else, using the sliders will disable undo/redo and other shortcuts
        // until you click something else.
        // - and there's keys that affect the sliders anyway, so it doesn't
        //   sacrifice functionality. (wasd, and q and e.)
        // - use onchange, not onfocus. unfocusing during the click makes it so
        //   you can't drag the slider.
        // - and the touch-action thing is because without that, on mobile,
        //   sliders can't really be slid. just changed.
        //this.html.frame_y.parentElement.style.width = this.html.frame_y.getBoundingClientRect().width + "px";
        // even this doesn't work.
        this.html.undo.onclick = function(e) { _this.states.undo() };
        this.html.redo.onclick = function(e) { _this.states.redo() };
        this.html.save.onclick = function(e) {
            _this.filename = (prompt("enter a file name.") ?? "").trim() || _this.filename;
            savecanvas(_this.canvas, _this.filename + ".png");
        };
        this.html.load.onclick = function(e) {
            let input = document.createElement("input");
            input.type = "file";
            input.accept = ".png";
            input.oninput = function() {
                let reader = new FileReader();
                reader.onload = function() {
                    //console.log(reader.result);
        			let image = document.createElement("img");
        			let ctx = _this.ctx;
        			let canvas = _this.canvas;
        			image.src = reader.result;
                    image.onload = function(e) {
                        canvas.width = e.target.width;
                        canvas.height = e.target.height;
                        ctx.drawImage(e.target, 0, 0);
                        _this.update_frame_scroll();
                        _this.refresh();
                    }
                };
                reader.readAsDataURL(input.files[0]);
                _this.filename = filename_handler(input.files[0].name);
            };
            input.click();
		};
        //
        this.html.deselect.onclick = function(e) {
            _this.select = null;
            _this.refresh("save");
        };
        /*
        this.html.set_as_grid.onclick = function(e) {
            if(_this.select) {
                _this.grid = Rect.abs(_this.select);
            };
        };
        //*/
        function _copy(cut) {
            if(!_this.select) {
                return;
            };
            let ctx = _this.ctx;
            let rect = Rect.abs(_this.select);
            _this.copydata = copy(ctx, rect.x, rect.y, rect.w, rect.h, _this.backcolor);
            if(cut) {
                ctx.fillStyle = _this.backcolor;
                ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
                ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                _this.refresh();
            };
        }
        this.html.cut.onclick = function(e) { _copy(true) };
        this.html.copy.onclick = function(e) { _copy(false) };
        function swap(dir) {
            if(!_this.select) {
                return;
            };
            let rect1 = Rect.abs(_this.select);
            let rect2 = structuredClone(rect1);
            rect2.x += rect2.w*(dir === "l" ? -1 : dir === "r" ? 1 : 0);
            rect2.y += rect2.h*(dir === "u" ? -1 : dir === "d" ? 1 : 0);
            let temp = Rect.new(0, 0, _this.canvas.width, _this.canvas.height);
            if(!Rect.encloses(temp, rect1) || !Rect.encloses(temp, rect2)) {
                return;
            };
            let ctx = _this.ctx;
            let image1 = ctx.getImageData(rect1.x, rect1.y, rect1.w, rect1.h);
            let image2 = ctx.getImageData(rect2.x, rect2.y, rect2.w, rect2.h);
            ctx.putImageData(image1, rect2.x, rect2.y);
            ctx.putImageData(image2, rect1.x, rect1.y);
            let rect = structuredClone(_this.select);
            rect.x += rect2.x - rect1.x;
            rect.y += rect2.y - rect1.y;
            _this.select = structuredClone(rect);
            _this.refresh();
        };
        this.html.swap_l.onclick = function(e) { swap("l") };
        this.html.swap_r.onclick = function(e) { swap("r") };
        this.html.swap_u.onclick = function(e) { swap("u") };
        this.html.swap_d.onclick = function(e) { swap("d") };
        function shift(dir, grid) {
            if(!_this.select) {
                return;
            };
            let rect = structuredClone(_this.select);
            rect.x += (grid ? _this.grid.w : Math.abs(rect.w))*(dir === "l" ? -1 : dir === "r" ? 1 : 0);
            rect.y += (grid ? _this.grid.h : Math.abs(rect.h))*(dir === "u" ? -1 : dir === "d" ? 1 : 0);
            if(Rect.encloses(Rect.new(0, 0, _this.canvas.width, _this.canvas.height), rect)) {
                _this.select = structuredClone(rect);
            };
        }
        this.html.shift_l.onclick = function(e) { shift("l") };
        this.html.shift_r.onclick = function(e) { shift("r") };
        this.html.shift_u.onclick = function(e) { shift("u") };
        this.html.shift_d.onclick = function(e) { shift("d") };
        this.html.grid_shift_l.onclick = function(e) { shift("l", true) };
        this.html.grid_shift_r.onclick = function(e) { shift("r", true) };
        this.html.grid_shift_u.onclick = function(e) { shift("u", true) };
        this.html.grid_shift_d.onclick = function(e) { shift("d", true) };
        function mirror_rotate(operation) {
            let w = _this.canvas.width;
            let h = _this.canvas.height;
            let rect = Rect.new(0, 0, w, h);
            rect = _this.select ? Rect.overlap(_this.select, rect) : rect;
            // it's possible for select to be partially off the canvas.
            let select_change = null;
            // if the code changes select, that should be done AFTER refresh.
            // since, thee state's .select represents what select was before the
            // next change.
            if(!rect || !rect.w || !rect.h) {
                return;
            };
            if((operation === "rotate 90" || operation === "rotate 270") && _this.select) {
                let copydata = copy(_this.ctx, rect.x, rect.y, rect.w, rect.h, _this.backcolor);
                _this.ctx.fillStyle = _this.backcolor;
                _this.ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
                _this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                // cut
                let _copydata = {w: rect.h, h: rect.w};
                for(let i1 = 0; i1 < _copydata.w*_copydata.h; i1++) {
                    let x = i1%_copydata.w;
                    let y = Math.floor(i1/_copydata.w);
                    _copydata[i1] = new Uint8ClampedArray(copydata[x*copydata.w + y]);
                }
                // restructure the data so x and y are switched
                /*
                if(rect.w < rect.h && operation === "rotate 90") {
                    rect.x -= rect.h - rect.w;
                }
                else if(rect.w > rect.h && operation === "rotate 270") {
                    rect.y -= rect.w - rect.h;
                }
                //*/
                // these adjustments just make it look more like rotation.
                paste(_this.ctx, _copydata, rect.x, rect.y);
                // paste
                rect = Rect.overlap(Rect.new(rect.x, rect.y, rect.h, rect.w), Rect.new(0, 0, w, h));
                select_change = structuredClone(rect);
                // switch the select dimensions (trim it if it goes out of
                // bounds)
                operation = operation === "rotate 90" ? "x mirror" : operation === "rotate 270" ? "y mirror" : operation;
                // rotate 90 changes the coordinates so they're (-y, x). 270
                // changes them so they're (y, -x). so, if you switch x and y,
                // then do a mirror... that creates the effect you need.
            }
            let data = _this.ctx.getImageData(rect.x, rect.y, rect.w, rect.h).data;
            let _data = new Uint8ClampedArray(4*rect.w*rect.h);
            let _rect = rect;
            if(operation === "rotate 90" || operation === "rotate 270") {
                _rect = Rect.new(rect.x, rect.y, rect.h, rect.w);
            };
            for(let i1 = 0; i1 < _rect.w*_rect.h; i1++) {
                let x = i1%_rect.w;
                let y = Math.floor(i1/_rect.w);
                if(operation === "x mirror" || operation === "rotate 180" || operation === "rotate 90") {
                    x = _rect.w - 1 - x;
                };
                if(operation === "y mirror" || operation === "rotate 180" || operation === "rotate 270") {
                    y = _rect.h - 1 - y;
                };
                if(operation === "rotate 90" || operation === "rotate 270") {
                    let temp = x;
                    x = y;
                    y = temp;
                };
                // x mirror: -x, y
                // y mirror: x, -y
                // rotate 90: -y, x
                // rotate 180: -x, -y
                // rotate 270: y, -x
                for(let i2 = 0; i2 < 4; i2++) {
                    _data[4*i1 + i2] = data[4*(y*rect.w + x) + i2];
                }
            }
            _data = new ImageData(_data, _rect.w, _rect.h);
            if(operation === "rotate 90" || operation === "rotate 270") {
                if(_this.select) {
                    console.log("this shouldn't happen");
                }
                else {
                    _this.canvas.width = _rect.w;
                    _this.canvas.height = _rect.h;
                    _this.ctx.clearRect(0, 0, _rect.w, _rect.h);
                    _this.ctx.putImageData(_data, 0, 0);
                    _this.update_frame_scroll();
                }
            }
            else {
                _this.ctx.clearRect(_rect.x, _rect.y, _rect.w, _rect.h);
                _this.ctx.putImageData(_data, _rect.x, _rect.y);
            }
            _this.refresh();
            if(select_change) {
                _this.select = structuredClone(select_change);
            };
        }
        this.html.x_mirror.onclick = function(e) { mirror_rotate("x mirror") };
        this.html.y_mirror.onclick = function(e) { mirror_rotate("y mirror") };
        this.html.rotate_90.onclick = function(e) { mirror_rotate("rotate 90") };
        this.html.rotate_180.onclick = function(e) { mirror_rotate("rotate 180") };
        this.html.rotate_270.onclick = function(e) { mirror_rotate("rotate 270") };
        //this.html.rotate_90.hidden = true;
        //this.html.rotate_270.hidden = true;
        this.html.color_replace.onclick = function(e) {
            let i1 = 0;
            let color1 = prompt("enter the color you want to replace.\n\nif you enter nothing, it'll be the backcolor, " + _this.backcolor + ".\n\nnumbers can be used to refer to colors in the palette.");
            if(color1 === null) {
                return;
            };
            let color2 = prompt("enter the color you want to replace it with.\n\nif you enter nothing, it'll be the forecolor, " + _this.forecolor + ".\n\nnumbers can be used to refer to colors in the palette.");
            if(color2 === null) {
                return;
            };
            color1 = _this.color_input(color1, _this) || _this.backcolor;
            color2 = _this.color_input(color2, _this) || _this.forecolor;
            _this.ctx.fillStyle = color2;
            let rect = _this.select ? Rect.abs(_this.select) : Rect.new(0, 0, _this.canvas.width, _this.canvas.height);
            for(i1 = 0; i1 < rect.w*rect.h; i1++) {
                let coor = Rect.getcoor(rect, i1);
                if(!coor) {
                    console.log("this shouldn't happen");
                }
                else if(getcolor(_this.ctx, ...coor) === color1) {
                    _this.ctx.fillRect(...coor, 1, 1);
                };
            }
            _this.refresh();
        };
        this.html.color_add.onclick = function(e) {
            let rect = _this.select ? Rect.abs(_this.select) : Rect.new(0, 0, _this.canvas.width, _this.canvas.height);
            for(let i1 = 0; i1 < rect.w*rect.h; i1++) {
                let coor = Rect.getcoor(rect, i1);
                if(!coor) {
                    console.log("this shouldn't happen");
                }
                else {
                    let color = getcolor(_this.ctx, ...coor);
                    if(!_this.palette.includes(color)) {
                        _this.palette.push(color);
                    }
                }
            };
            _this.refresh_palette();
        };
        this.html.outline.onclick = function(e) {
            let rect = Rect.new(0, 0, w, h);
            rect = _this.select ? Rect.overlap(_this.select, rect) : rect;
            let imagedata = _this.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
            let raster = [];
            for(let i1 = 0; i1 < rect.w*rect.h; i1++) {
                let color = "#";
                for(let i2 = 0; i2 < 4; i2++) {
                    let num = imagedata.data[4*i1 + i2];
                    if(i2 !== 3 || num !== 255) {
                        color += numtohex(num, 2);
                    }
                }
                raster.push(imagedata.data[4*i1 + 3] && color !== _this.backcolor);
            }
            let outline = Raster.outline(raster, rect.w, _this.html.outline_diagonals.checked, true);
            _this.ctx.fillStyle = _this.forecolor;
            for(let i1 = 0; i1 < rect.w*rect.h; i1++) {
                let coor = Rect.getcoor(rect, i1);
                if(coor) {
                    if(outline[i1]) {
                        _this.ctx.fillRect(...coor, 1, 1);
                    };
                }
                else {
                    console.log("this shouldn't happen");
                };
            }
            _this.refresh();
        };
        //
        this.select_interval = setInterval(function() {
            if(_this.stroke || _this.tool === "anim") {
                return;
            }
            _this.select_ticktock = !_this.select_ticktock;
            _this.refresh("states");
        }, 1000/2);
    }
    get frame_x() {
        let x = Number(this.html.frame_x.value);
        if(!Number.isInteger(x) || x < 0) {
            x = 0;
            this.html.frame_x.value = x;
        };
        return x;
    }
    get frame_y() {
        let y = Number(this.html.frame_y.value);
        if(!Number.isInteger(y) || y < 0) {
            y = 0;
            this.html.frame_y.value = y;
        };
        return y;
    }
    get frame_size() {
        let size = Number(this.html.frame_size.value);
        if(!Number.isInteger(size) || size <= 0) {
            size = 1;
            this.html.frame_size.value = size;
        }
        return size;
    }
    get frame_rect() {
        let size = this.frame_size;
        return Rect.new(
            this.frame_x, this.frame_y,
            Math.min(this.canvas.width, size*this.frame_w_inc),
            Math.min(this.canvas.height, size*this.frame_h_inc),
        );
    }
    refresh(skip) {
    // refreshes things. there are three main actions.
    // - "frame": refreshes the frame to show whatever it's supposed to right
    //   now.
    //   - this includes changes to frame x/y/size.
    //   - it also clears graphics, if they were there.
    // - "states": saves a new state.
    // - "graphics": draws the select border.
    //   - it ONLY draws it. it doesn't clear any previous select borders. only
    //     "frame" does that.
    // =
    // - skip is an array of which of these actions to skip. (or a string of one
    //   thing to skip.)
        skip = Array.isArray(skip) ? skip : typeof skip === "string" ? [skip] : [];
        let rect = null;
        let anim = this.tool === "anim";
        if(anim && !skip.includes("frame")) {
            let ctx = this.frame_ctx;
            let source = Rect.abs(this.select);
            // rectangle for where on the canvas the frame it's drawing is.
            let frame = this.anim_frame;
            let wrap = this.anim_wrap;
            let axis1 = Number(this.html.anim_vertical.checked);
            let axis2 = posmod(axis1 + 1, 2);
            //console.log([this.anim_playing, frame%wrap, Math.floor(frame/wrap)]);
            source["xy"[axis1]] += (frame%wrap)*source["wh"[axis1]];
            source["xy"[axis2]] += Math.floor(frame/wrap)*source["wh"[axis2]];
            // wrap is how many frames there are before it goes to the next
            // row. or, if it's vertical, the next column.
            ctx.fillStyle = this.backcolor;
            ctx.clearRect(0, 0, this.html.frame.width, this.html.frame.height);
            ctx.fillRect(0, 0, this.html.frame.width, this.html.frame.height);
            // if a frame doesn't render or only renders partially, (because
            // it's partially or fully off the canvas) the emptiness should be
            // filled by backcolor.
            let place = [source.x, source.y];
            source = Rect.overlap(source, Rect.new(0, 0, this.canvas.width, this.canvas.height));
            if(source) {
                place = [
                    source.x - place[0],
                    source.y - place[1]
                ];
                ctx.putImageData(this.ctx.getImageData(source.x, source.y, source.w, source.h), ...place);
            };
            // Rect.overlap and place account for it being fully or partially
            // off the canvas.
            // - if you use getImageData on a rectangle like that, the
            //   pixels that are off the canvas are returned as transparent
            //   pixels, rgba(0, 0, 0, 0).
            // - i don't want that. it'd look weird. it should be backcolor
            //   instead. so, Rect.overlap makes sure it only gets pixels that
            //   are within bounds.
        };
        if(!anim && !skip.includes("frame")) {
            rect ??= this.frame_rect;
            this.html.frame.width = rect.w;
            this.html.frame.height = rect.h;
            this.frame_ctx.putImageData(this.ctx.getImageData(rect.x, rect.y, rect.w, rect.h), 0, 0);
            let size = this.frame_size;
            let size_mod = this.viewport_size/size;
            let gap = [
                (size*this.frame_w_inc - rect.w)*size_mod,
                (size*this.frame_h_inc - rect.h)*size_mod
            ];
            //console.log(gap);
            this.html.frame.style.width = rect.w*size_mod + "px";
            this.html.frame.style.height = rect.h*size_mod + "px";
            //gap = gap[1] + "px " + gap[0] + "px";
            gap = gap[1]/2 + "px " + gap[0]/2 + "px " + gap[1]/2 + "px " + gap[0]/2 + "px";
            //gap = gap[1]/2 + "px " + gap[0]/4 + "px " + gap[1]/4 + "px " + gap[0]/2 + "px";
            /*
            if(gap !== this.html.viewport.style.padding) {
                this.html.viewport.style.padding = gap;
            };
            //*/
            //*
            if(gap !== this.html.frame.style.margin) {
                this.html.frame.style.margin = gap;
            };
            //*/
            // - no matter how big it is, the frame is sized to take up the
            //   whole viewport.
            // - that usually works out just fine, but not if it's zoomed out
            //   enough to show discrepancies between the aspect ratio of the
            //   canvas and the viewport. you have to add padding.
            // - that's what gap is. the ratio of gap[0] + rect.w and gap[1] +
            //   rect.h will always match the ratio of the viewport. so, if you
            //   add this many pixels of empty space to the sides of the canvas,
            //   it'll work out.
            // - but css pixels aren't the same as canvas pixels. since the
            //   canvas is scaled to fit. that's what size_mod is for. canvas
            //   pixels * viewport_size / frame_size = css pixels.
            let edges = Rect.edges(rect);
            edges = [
                edges[0] <= 0,
                edges[1] >= this.canvas.width,
                edges[2] <= 0,
                edges[3] >= this.canvas.height
            ];
            let dir = "left right top bottom".split(" ");
            for(let i1 = 0; i1 < 4; i1++) {
                let property = "border-" + dir[i1];
                let value = edges[i1] ? "2px dotted" : "initial";
                if(value !== this.html.frame.style[property]) {
                    this.html.frame.style[property] = value;
                };
            }
            // show borders only if the frame shows the edge of the canvas.
        };
        if(!skip.includes("states")) {
            this.states.save();
        };
        if(!anim && !skip.includes("graphics")) {
            rect ??= this.frame_rect;
            let ctx = this.frame_ctx;
            let w = this.canvas.width;
            let h = this.canvas.height;
            if(this.select) {
                let border = this.select_border;
                for(let i1 = (this.select_ticktock ? 1 : 0); i1 < border.length; i1 += 2) {
                    let x = border[i1][0];
                    let y = border[i1][1];
                    if(Rect.inside(rect, x, y)) {
                        let temp = this.ctx.getImageData(x, y, 1, 1).data;
                        ctx.fillStyle = "rgb(" + (255 - temp[0]) + ", " + (255 - temp[1]) + ", " + (255 - temp[2]) + ")";
                        ctx.fillRect(x - rect.x, y - rect.y, 1, 1);
                    }
                }
            };
        };
    }
    update_frame_scroll() {
    // updates the maximum values of this.html frame_x and frame_y. ALWAYS use
    // this when changing the dimensions of the main canvas, or changing
    // frame_size.
        let w = this.canvas.width;
        let h = this.canvas.height;
        let size = this.frame_size;
        let _w = size*this.frame_w_inc;
        let _h = size*this.frame_h_inc;
        let temp = [this.frame_x, this.frame_y];
        this.html.frame_x.max = Math.max(0, w - _w);
        this.html.frame_y.max = Math.max(0, h - _h);
        this.html.frame_x.value = temp[0];
        this.html.frame_y.value = temp[1];
        temp = [
            Math.max(
                Math.ceil(w/this.frame_w_inc),
                Math.ceil(h/this.frame_h_inc)
            ),
            Number(this.html.frame_size.max)
        ];
        if(temp[0] !== temp[1]) {
            this.html.frame_size.max = temp[0];
            this.html.frame_size.value = temp[0];
        }
        this.html.dimension_text.innerHTML = ["[", _w, "\u00D7", _h, "] / [", w, "\u00D7", h, "]"].join(" ");
    }
    anim_select_change() {
    // runs when switching to the anim tool, and if the dimensions of the
    // selection change while in the anim tool.
        let w = Math.abs(this.select.w);
        let h = Math.abs(this.select.h);
        this.html.frame.width = w;
        this.html.frame.height = h;
        // change frame dimensions to match the animation frame
        let size_mod = Math.min(
            this.viewport_size*this.frame_w_inc/w,
            this.viewport_size*this.frame_h_inc/h
        );
        let gap = [
            this.viewport_size*this.frame_w_inc - size_mod*w,
            this.viewport_size*this.frame_h_inc - size_mod*h
        ];
        // how much the dimensions can be multiplied before it hits the
        // edges, and the gap that creates
        this.html.frame.style.width = size_mod*w + "px";
        this.html.frame.style.height = size_mod*h + "px";
        this.html.frame.style.margin = gap[1]/2 + "px " + gap[0]/2 + "px " + gap[1]/2 + "px " + gap[0]/2 + "px";
        this.html.frame.style.border = "2px dotted";
        // css, go.
    }
    clickxy(e) {
        let rect = this.frame_rect;
        let _rect = e.target.getBoundingClientRect();
        let x = (e.clientX - _rect.x)/_rect.width;
        let y = (e.clientY - _rect.y)/_rect.height;
        // make them 0 to 1 numbers relative to the edges of the frame
        return [
            Math.floor(rect.x + x*rect.w),
            Math.floor(rect.y + y*rect.h)
        ];
        // make those frame coordinates coordinates on the canvas
    }
    static valid = {
        tools: [
            "pen",
            "eraser",
            "dither",
            "colorpick",
            "bucket",
            "line",
            "rectangle",
            "ellipse",
            "text",
            "ramp",
            "select",
            "grid select",
            "select move",
            "select scale",
            "anim",
            "fx",
            "paste"
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
        refresh: ["frame", "states", "graphics"],
    }
    palette_col(_this) {
        _this ??= this;
        return Math.floor(_this.viewport_size*_this.frame_h_inc/PixelArt.palette_cell_h);
    }
    // how many colors a column can have before a new column starts
    static palette_cell_w = 48
    static palette_cell_h = 16
    // how many pixels wide and tall one color of the palette is.
    refresh_palette(allcodes) {
    // refreshes the palette canvas to account for changes.
        Color.palette_canvas(
            this.palette_ctx, this.palette,
            this.palette_col(),
            PixelArt.palette_cell_w, PixelArt.palette_cell_h,
            true,
            (allcodes ? null : this.palette_index)
        );
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
    color_input(color, _this) {
    // used in the color replace button, and the color ramp tool.
    // - empty strings stay empty, to be replaced with forecolor or something.
    // - numbers are converted to palette colors.
    // - anything else is colortohex-ed.
        _this ??= this;
        color = color.trim();
        let num = Number(color);
        if(color && Number.isInteger(num) && num >= 0 && num < _this.palette.length) {
            color = _this.palette[num];
        }
        else if(color) {
            color = colortohex(_this.ctx, color);
        };
        return color;
    }
    //
    get tool() {
        return this._tool;
    }
    set tool(value) {
        if(!PixelArt.valid.tools.includes(value)) {
            console.log("this shouldn't happen");
            return;
        };
        let prev = this.tool;
        if(value === prev) {
            return;
        };
        this._tool = value;
        document.getElementsByName(this.prefix + "_tool").forEach(function(element) {
            element.checked = element.value === value;
        });
        let settings = htmldescendants(this.html.tool_settings);
        for(let i1 = 0; i1 < settings.length; i1++) {
        // hide irrelevant settings, show relevant settings.
            let ref = settings[i1];
            let name = ref.name || ref.attributes?.class?.value || "";
            if(name) {
                if(ref.parentElement.tagName.toLowerCase() === "label") {
                    ref = ref.parentElement;
                }
                let hide = !name.startsWith(value);
                if(name === "shape fill") {
                    hide = value !== "rectangle" && value !== "ellipse";
                }
                else if(value === "select" && !hide && name.includes(" ")) {
                // pain in my ass.
                    let temp = name.split(" ").slice(0, 2).join(" ");
                    hide = PixelArt.valid.tools.includes(temp);
                }
                ref.hidden = hide;
            }
        }
        if(this.anim_playing) {
        // anim_playing should only be on if "anim" is selected and there's a
        // frame selected.
            this.anim_playing = false;
        };
        if(prev === "anim" || value === "anim") {
            if(value === "anim") {
            // while anim is selected, the viewport only shows the animation
            // frame, as big as will fit.
                this.html.frame_x.disabled = true;
                this.html.frame_y.disabled = true;
                this.html.frame_size.disabled = true;
                // disable scroll bars
                this.anim_select_change();
                // adjusts frame dimensions, applies css edits (scaling it up,
                // margin, border)
            }
            else if(prev === "anim") {
                this._anim_frame = 0;
                // switching should reset this
                this.html.frame_x.disabled = false;
                this.html.frame_y.disabled = false;
                this.html.frame_size.disabled = false;
                let rect = this.frame_rect;
                let w = Math.abs(rect.w);
                let h = Math.abs(rect.h);
                this.html.frame.width = w;
                this.html.frame.height = h;
                // reverse everything switching to anim does. (the css stuff
                // will be done in refresh.)
            }
            // update_frame_scroll is unnecessary because it only affects
            // scrollbar maximums and the text under the size bar. as long as
            // it's disabled, it should be fine.
            this.refresh("states");
        };
    }
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
    get dither_r() {
        let num = Number(this.html.dither_r.value);
        if(!Number.isInteger(num) || num < 0) {
            num = 0;
            this.html.dither_r.value = num;
        }
        return num;
    }
    get anim_duration() {
        let num = Number(this.html.anim_duration.value);
        if(!Number.isInteger(num) || num <= 0) {
            num = 1;
            this.html.anim_duration.value = num;
        }
        return num;
    }
    get anim_wrap() {
        let num = Number(this.html.anim_wrap.value);
        if(!Number.isInteger(num) || num <= 0) {
            if(num === 0) {
                return this.anim_duration;
            }
            else {
                num = 1;
                this.html.anim_wrap.value = num;
            }
        }
        return num;
    }
    get anim_frame() {
        return this._anim_frame;
    }
    set anim_frame(value) {
        let duration = this.anim_duration;
        if(!Number.isInteger(value)) {
            console.log("this shouldn't happen");
            value = 0;
        }
        else if(!duration) {
            console.log("this shouldn't happen");
            duration = 1;
            this.html.anim_duration.value = duration;
        }
        this._anim_frame = posmod(value, duration);
        this.refresh("states");
    }
    get anim_playing() {
        return this._anim_playing;
    }
    set anim_playing(value) {
        if(value && (this.tool !== "anim" || !this.select)) {
            return;
        }
        else if(!!value === this.anim_playing) {
        // this could cause the interval to be doubled or something. if it's set as true when it was already true.
            return;
        }
        this._anim_playing = !!value;
        this.html.anim_prev.disabled = !!value;
        this.html.anim_next.disabled = !!value;
        if(value) {
            let fps = readnumber(this.html.anim_fps.value);
            if(fps === null || fps <= 0) {
                fps = 12;
                this.html.anim_fps.value = fps;
            };
            let _this = this;
            this.anim_interval = setInterval(function() {
                _this.anim_frame++;
                if(!_this.html.anim_loop.checked && _this.anim_frame === _this.anim_duration - 1) {
                    _this.anim_playing = false;
                };
            }, 1000/fps);
        }
        else {
            clearInterval(this.anim_interval);
            this.anim_interval = null;
        }
    }
    get fx_offset() {
        let offset = readpoint(this.html.fx_offset.value);
        return [
            offset[0] ?? 0,
            offset[1] ?? 0,
            offset[2] ?? 0
        ];
    }
    set fx_offset(value) {
        if(!Points.valid(value)) {
            return;
        };
        let offset = [
            value[0] ?? 0,
            value[1] ?? 0,
            value[2] ?? 0
        ];
        offset = offset[2] ? offset : offset.slice(0, 2);
        this.html.fx_offset.value = offset.join(", ");
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
    get select() {
        if(this._select && (!this._select.w || !this._select.h)) {
            this.select = null;
        };
        return this._select;
    }
    set select(value) {
        let prev = structuredClone(this._select);
        this._select = Rect.valid(value) ? value : null;
        let select = this._select;
        this.states.current.select = structuredClone(select);
        let list = htmldescendants(this.html.selection_actions).filter((element) => (
            element.tagName.toLowerCase() === "button"
            &&
            !element.name.endsWith("mirror")
            &&
            !element.name.startsWith("rotate")
            &&
            !element.name.startsWith("color")
        ));
        this.html.deselect.disabled = !select;
        for(let i1 = 0; i1 < list.length; i1++) {
            list[i1].disabled = !select;
        };
        document.getElementsByName(this.prefix + "_tool").forEach(function(element) {
            if(element.value.startsWith("select ") || element.value === "anim" || element.value === "fx") {
                element.disabled = !select;
            };
        });
        this.select_border = select ? Rect.border(select) : [];
        if(!select && (this.tool.startsWith("select ") || this.tool === "anim" || this.tool === "fx")) {
        // anim requires a selection.
            this.tool = PixelArt.valid.tools[0];
        };
        if(this.tool === "anim" && prev && (!select || prev.w !== select.w || prev.h !== select.h)) {
            this.anim_select_change();
        };
        this.fx_offset = [0, 0, 0];
    }
    get grid() {
    // a rectangle, used in various tools and buttons.
    // - this must always return a rectangle with positive dimensions. never
    //   null, never negative or zero dimensions.
        let inc = Number(this.html.grid_inc.value);
        if(!Number.isInteger(inc) || inc <= 0) {
            inc = 8;
            this.html.grid_inc.value = inc;
        }
        return Rect.new(0, 0, inc, inc);
    }
    get copydata() {
        return this._copydata;
    }
    set copydata(value) {
        this._copydata = value;
        document.getElementsByName(this.prefix + "_tool").forEach(function(element) {
            if(element.value === "paste") {
                element.disabled = !value;
            };
        });
    }
    mousedown(e, _this) {
        let i1 = 0;
        _this ??= this;
        if(_this.select && !Rect.overlap(_this.select, _this.frame_rect) && !_this.tool.startsWith("select") && _this.tool !== "colorpick" && _this.tool !== "anim" && _this.tool !== "fx" && _this.tool !== "paste") {
            alert("click the deselect button first. (you have a selection, but it's offscreen. you can't edit anything outside a selection until you deselect.)");
            return;
        };
        let click = _this.clickxy(e);
        if(_this.tool.startsWith("select ") && !_this.select) {
        // select tools are disabled when there's nothing selected, but that
        // doesn't prevent the user from using them anyway. (like if you
        // deselect while a select tool is selected.)
            return;
        }
        else if(_this.tool === "anim") {
        // all this does is pause/play the animation. by exiting before .stroke
        // is made, it guarantees mousemove/mouseup exit early too.
            _this.anim_playing = !_this.anim_playing;
        };
        _this.stroke = {
            path: [structuredClone(click)],
            // coordinates of each point in the mouse's movement
            image: _this.states.current.image,
            // image to use to reset the graphics. (usually, this is identical
            // to _this.states.current.image.)
        };
        if(_this.tool === "paste" || _this.tool === "colorpick" || _this.tool === "text" || _this.tool === "ramp" || _this.tool === "fx") {
        // for these tools, everything happens in mousemove/mouseup.
            _this.mousemove(e, _this);
            return;
        };
        let stroke = _this.stroke;
        let ctx = _this.ctx;
        //
        if(_this.tool === "pen" || _this.tool === "eraser" || _this.tool === "dither") {
            stroke.prev = null;
        }
        else if(_this.tool === "bucket") {
            const select = _this.select ? Rect.abs(_this.select) : Rect.new(0, 0, _this.canvas.width, _this.canvas.height);
            if(Rect.inside(select, ...click)) {
                const image = ctx.getImageData(select.x, select.y, select.w, select.h).data;
                let raster = [];
                for(i1 = 0; i1 < image.length; i1 += 4) {
                    let alpha = image[i1 + 3];
                    raster.push(
                        alpha
                        ?
                        (image[i1 + 0] + "," + image[i1 + 1] + "," + image[i1 + 2] + "," + alpha)
                        :
                        ""
                    );
                }
                raster = Raster.bucket(
                    raster, select.w,
                    click[0] - select.x, click[1] - select.y,
                    _this.html.bucket_diagonal.checked
                );
                ctx.fillStyle = _this.forecolor;
                for(i1 = 0; i1 < raster.length; i1++) {
                    if(raster[i1]) {
                        if(_this.html.bucket_mask.checked) {
                            ctx.clearRect(...Rect.getcoor(select, i1), 1, 1);
                        }
                        else {
                            ctx.fillRect(...Rect.getcoor(select, i1), 1, 1);
                        }
                    }
                }
                _this.stroke = null;
                // make sure mousemove events don't trigger
                _this.refresh();
            }
        }
        else if(_this.tool === "select move" || _this.tool === "select scale") {
            if(_this.select) {
                let rect = Rect.abs(_this.select);
                stroke.copydata = copy(ctx, rect.x, rect.y, rect.w, rect.h, _this.backcolor);
                if(_this.tool === "select scale") {
                    stroke.x_sign = Number(click[0] >= Rect.r(rect)) - Number(click[0] < Rect.l(rect));
                    stroke.y_sign = Number(click[1] >= Rect.d(rect)) - Number(click[1] < Rect.u(rect));
                    if(!stroke.x_sign && !stroke.y_sign) {
                        let dir = get2dangle(...Points.subtract(click, Rect.center(rect)), true) ?? 0;
                        dir = posmod(dir/(2*Math.PI) - 1/8, 1);
                        dir = Math.floor(4*dir);
                        stroke.x_sign = dir === 0 ? 1 : dir === 2 ? -1 : 0;
                        stroke.y_sign = dir === 1 ? 1 : dir === 3 ? -1 : 0;
                    }
                }
                ctx.fillStyle = _this.backcolor;
                ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
                ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                stroke.image = ctx.getImageData(0, 0, _this.canvas.width, _this.canvas.height);
            }
        }
    }
    mousemove(e, _this, finish) {
        let i1 = 0;
        let i2 = 0;
        _this ??= this;
        let click = _this.clickxy(e);
        let stroke = _this.stroke;
        if(!stroke) {
        // exit if they're not in the middle of a stroke
            return;
        }
        stroke.path.push(structuredClone(click));
        let start = stroke.path.length ? stroke.path[0] : null;
        let end = stroke.path.length ? stroke.path[stroke.path.length - 1] : null;
        let w = _this.canvas.width;
        let h = _this.canvas.height;
        let ctx = _this.ctx;
        ctx.putImageData(stroke.image, 0, 0);
        _this.refresh("states");
        const select = _this.select ? Rect.abs(_this.select) : null;
        //
        if(_this.tool === "pen" || _this.tool === "eraser" || _this.tool === "dither") {
            if(stroke.path.length) {
                start = stroke.path[stroke.path.length - (stroke.path.length >= 2 ? 2 : 1)];
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
                ctx.fillStyle = _this[(_this.tool === "eraser" ? "back" : "fore") + "color"];
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
                            if(coor && (!this.select || Rect.inside(_this.select, ...coor))) {
                                if(_this.tool === "eraser" && _this.html.eraser_mask.checked) {
                                    ctx.clearRect(...coor, 1, 1);
                                }
                                else if(_this.tool !== "dither" ? true : (
                                    dither_interpreter(_this.html.dither_type.value, ...coor, _this.html.dither_invert.checked)
                                    &&
                                    (!_this.html.dither_back.checked || getcolor(ctx, ...coor) === _this.backcolor)
                                )) {
                                    ctx.fillRect(...coor, 1, 1);
                                };
                            };
                        }
                    }
                }
                stroke.image = ctx.getImageData(0, 0, w, h);
                stroke.prev = structuredClone(coverage);
            }
        }
        else if(_this.tool === "colorpick") {
            let type = _this.html.colorpick_type.innerText;
            let color = getcolor(ctx, ...click);
            if(type === "forecolor" || type === "backcolor") {
                _this[type] = color;
                if(finish) {
                    _this.tool = type === "backcolor" ? "eraser" : "pen";
                }
            }
            else if(type === "add to palette") {
                if(_this.palette[_this.palette.length - 1] !== color) {
                    _this.palette.push(color);
                    let index = _this.palette_index;
                    _this.palette_index = _this.palette.length - 1;
                    _this.refresh_palette();
                    if(!finish) {
                        _this.palette_index = index;
                        _this.palette.splice(_this.palette.length - 1, 1);
                    }
                }
            }
            else {
                console.log("this shouldn't happen");
            }
        }
        else if(_this.tool === "select" || _this.tool === "grid select") {
            if(stroke.path.length) {
                let _select = structuredClone(_this.select);
                if(_this.tool === "grid select") {
                    let grid = _this.grid;
                    let temp = [
                        Math.floor((start[0] - grid.x)/grid.w),
                        Math.floor((start[1] - grid.y)/grid.h),
                        Math.floor((end[0] - grid.x)/grid.w),
                        Math.floor((end[1] - grid.y)/grid.h)
                    ];
                    temp = Rect.reach(Rect.new(temp[0], temp[1], 0, 0), temp[2], temp[3]);
                    temp.w++;
                    temp.h++;
                    _this.select = Rect.overlap(Rect.new(0, 0, _this.canvas.width, _this.canvas.height), Rect.new(
                        grid.w*temp.x + grid.x,
                        grid.h*temp.y + grid.y,
                        grid.w*temp.w,
                        grid.h*temp.h,
                    ));
                }
                else {
                    let temp = {
                        x: start[0],
                        y: start[1],
                        w: end[0] - start[0],
                        h: end[1] - start[1],
                    }
                    if(temp.w || temp.h) {
                    // - the way the selection is before this math, the start
                    //   and end of the rect are the top-left corners of the
                    //   pixels the start/end of the click were on.
                    // - but, the corners at the bottom and right edge are
                    //   unreachable if you do it like that. meaning, selections
                    //   can NEVER have pixels on the bottom or right edge.
                    // - so instead, you make it work like grid select, in that
                    //   the start and end represent "pixels the selection has
                    //   to contain". 1 x 1 blocks, not 0 x 0 corners.
                    // - and the reason this doesn't happen if the start and end
                    //   are on the same pixel is... if it doesn't, that means
                    //   you can easily deselect by clicking without dragging.
                    //   that's useful. it does is make 1 x 1 selections
                    //   impossible, but who cares.
                        temp.x += temp.w < 0;
                        temp.y += temp.h < 0;
                        temp.w += temp.w < 0 ? -1 : 1;
                        temp.h += temp.h < 0 ? -1 : 1;
                    };
                    _this.select = structuredClone(temp);
                };
                _this.refresh("states");
                if(!finish) {
                    _this.select = structuredClone(_select);
                }
            };
        }
        else if(_this.tool === "line" || _this.tool === "rectangle" || _this.tool === "ellipse") {
            if(stroke.path.length) {
                const filled = _this.html.shape_fill.checked;
                if(_this.tool === "line") {
                    ctx.strokeStyle = _this.forecolor;
                    linespecial(ctx, ...start, ...end);
                }
                else if(_this.tool === "rectangle") {
                    let temp = [start[0], start[1], end[0] - start[0], end[1] - start[1]];
                    if(filled) {
                        ctx.fillStyle = _this.forecolor;
                        ctx.fillRect(...temp);
                    }
                    else {
                        ctx.strokeStyle = _this.forecolor;
                        temp[0] += .5;
                        temp[1] += .5;
                        ctx.strokeRect(...temp);
                    }
                }
                else if(_this.tool === "ellipse") {
                    ctx.fillStyle = _this.forecolor;
                    let rect = Rect.reach(Rect.new(...start, 0, 0), ...end);
                    rect.w++;
                    rect.h++;
                    let raster = Raster.fullellipse(rect.w, rect.h);
                    if(!filled) {
                        raster = Raster.outline(raster, rect.w);
                    }
                    for(i1 = 0; i1 < raster.length; i1++) {
                        if(raster[i1]) {
                            ctx.fillRect(...Rect.getcoor(rect, i1), 1, 1);
                        }
                    }
                };
            }
        }
        else if(_this.tool === "text") {
            ctx.textBaseline = "alphabetic";
            ctx.font = "16px 'barkyfont'";
            ctx.fillStyle = _this.forecolor;
            ctx.fillText(_this.html.text_text.value.toLowerCase(), click[0], click[1] + 6);
        }
        else if(_this.tool === "ramp") {
            let start = _this.color_input(_this.html.ramp_start.value) || _this.forecolor;
            let end = _this.color_input(_this.html.ramp_end.value) || _this.backcolor;
            let num = Number(_this.html.ramp_number.value);
            let size = Number(_this.html.ramp_size.value);
            let vertical = _this.html.ramp_vertical.checked;
            ctx.fillStyle = start;
            ctx.fillRect(click[0], click[1], size, size);
            ctx.fillStyle = end;
            ctx.fillRect(
                click[0] + (vertical ? 0 : size*(1 + num)),
                click[1] + (vertical ? size*(1 + num) : 0),
                size, size
            );
            for(i1 = 0; i1 < 2; i1++) {
                let color = i1 ? end : start;
                let format = Color.format(color);
                if(format === "hex6") {
                    color += "ff";
                }
                else if(format !== "hex8") {
                    console.log("this shouldn't happen");
                };
                let _color = [];
                for(i2 = 0; i2 < 4; i2++) {
                    _color.push(parseInt(color.slice(1 + 2*i2, 3 + 2*i2), 16));
                }
                if(i1) {
                    end = structuredClone(_color);
                }
                else {
                    start = structuredClone(_color);
                };
            }
            for(i1 = 0; i1 < num; i1++) {
                let color = "#";
                for(i2 = 0; i2 < 4; i2++) {
                    let value = (1 + i1)/(num + 1);
                    value = (1 - value)*start[i2] + value*end[i2];
                    color += numtohex(Math.round(value), 2);
                }
                ctx.fillStyle = color;
                ctx.fillRect(
                    click[0] + (vertical ? 0 : size*(1 + i1)),
                    click[1] + (vertical ? size*(1 + i1) : 0),
                    size, size
                );
            }
        }
        else if(_this.tool === "select move") {
            if(_this.select && stroke.path.length) {
                let rect = structuredClone(_this.select);
                let shift = Points.subtract(end, start);
                if(_this.html.select_move_snap.checked) {
                    let grid = [_this.grid.w, _this.grid.h];
                    shift = Points.multiply(Points.trunc(Points.divide(shift, grid)), grid);
                };
                rect.x += shift[0];
                rect.y += shift[1];
                paste(ctx, stroke.copydata, Rect.l(rect), Rect.u(rect));
                if(finish) {
                    _this.select = structuredClone(rect);
                    // setting one property at a time wouldn't trigger the setter,
                    // so avoid that.
                }
                _this.refresh(["graphics", "states"]);
            }
        }
        else if(_this.tool === "select scale") {

        }
        else if(_this.tool === "paste") {
            if(_this.html.paste_snap.checked) {
                click = Rect.snap(_this.grid, ...click);
            };
            paste(ctx, _this.copydata, ...click);
            _this.refresh(["graphics", "states"]);
        }
        else if(_this.tool === "fx") {
            if(_this.select) {
                _this.fx_offset = Points.subtract(click, Rect.center(_this.select));
            };
        };
        //
        if(_this.tool === "line" || _this.tool === "rectangle" || _this.tool === "ellipse" || _this.tool === "text" || _this.tool === "ramp") {
            if(select) {
            // get rid of everything outside the selection
                let change = ctx.getImageData(select.x, select.y, select.w, select.h);
                ctx.putImageData(stroke.image, 0, 0);
                ctx.putImageData(change, select.x, select.y);
            };
            if(!finish) {
            // show changes
                _this.refresh("states");
            };
        };
        //
        if(finish) {
            _this.stroke = null;
            if(_this.tool !== "select" && _this.tool !== "grid select") {
                _this.refresh();
            };
        };
        if("pen, eraser, dither, line, rectangle, ellipse".split(", ").includes(_this.tool)) {
        // the select border should still be drawn during strokes, but don't
        // allow frame resets that would wipe your stroke.
            //_this.refresh(["frame", "states"]);
        };
    }
    mouseup(e, _this) {
        _this.mousemove(e, _this, true);
    }
    transfer(ctx, replace) {
    // used when transferring images from other tools.
    // - ctx: ctx to copy from
    // - replace: if true, it will replace the current image with this image,
    //   and save a new state. otherwise, it'll save it as copy/paste data.
    // - border: if true, it'll draw a rectangle around it to mark its borders.
    // - cell_w, cell_h: if these are valid, it'll mark the border at these
    //   intervals.
    //   - for example, armature artist sends animations, with multiple views
    //     and frames. this divides the image into cells, each with a different
    //     purpose.
    //   - it'd be helpful to see where the boundaries of those cells are, so
    //     there's two-pixel gaps in the borders where cells meet.
    // - name: this will be written above the border.
    // - the border and name are drawn in forecolor.
        let i1 = 0;
        let w = ctx.canvas.width;
        let h = ctx.canvas.height;
        if(replace) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.ctx.putImageData(ctx.getImageData(0, 0, w, h), 0, 0);
            if(this.select && !Rect.encloses(Rect.new(0, 0, w, h), this.select)) {
                this.select = Rect.overlap(Rect.new(0, 0, w, h), this.select);
            };
            this.update_frame_scroll();
            this.refresh();
        }
        else {
            this.copydata = copy(ctx, 0, 0, w, h);
            this.tool = "paste";
        };
    }
    keydown(e) {
    // put this in the page's onkeydown, within an "actually using this tool
    // right now" conditional.
    // - e: the KeyboardEvent.
        let key = keyinterpreter(e.key);
        let ctrl = e.ctrlKey;
        let shift = e.shiftKey;
        if(ctrl && shift) {
            if(key === "z") {
                this.html.redo.click();
                e.preventDefault();
            };
        }
        else if(ctrl) {
            if(key === "z") {
                this.html.undo.click();
                e.preventDefault();
            }
            else if(key === "s") {
                this.html.save.click();
                e.preventDefault();
            }
            else if(key === "o") {
                this.html.load.click();
                e.preventDefault();
            }
            else if(key === "c") {
                if(this.select) {
                    this.html.copy.click();
                };
                e.preventDefault();
            }
            else if(key === "x") {
                if(this.select) {
                    this.html.cut.click();
                };
                e.preventDefault();
            }
            else if(key === "v") {
                if(this.copydata) {
                    this.tool = "paste";
                };
                e.preventDefault();
            };
        }
        else if(shift) {

        }
        else if(this.tool !== "anim") {
            if(key === "a") {
                this.html.frame_x.value = this.frame_x - 1;
                this.html.frame_x.oninput();
                e.preventDefault();
            }
            else if(key === "d") {
                this.html.frame_x.value = this.frame_x + 1;
                this.html.frame_x.oninput();
                e.preventDefault();
            }
            else if(key === "w") {
                this.html.frame_y.value = this.frame_y - 1;
                this.html.frame_y.oninput();
                e.preventDefault();
            }
            else if(key === "s") {
                this.html.frame_y.value = this.frame_y + 1;
                this.html.frame_y.oninput();
                e.preventDefault();
            }
            else if(key === "q") {
                this.html.frame_size.value = this.frame_size - 1;
                this.html.frame_size.oninput();
                e.preventDefault();
            }
            else if(key === "e") {
                this.html.frame_size.value = this.frame_size + 1;
                this.html.frame_size.oninput();
                e.preventDefault();
            };
        }
    }
}
class Toy {
// objects that ToyPlayer uses.
// - closed: if true, it'll connect the first and last point and fill the shape.
// - makepoints: function. input the nodes, and it'll return a modified version
//   for visualization. for example, for splines, it would make lots of points
//   to form the splines' curves.
    constructor(closed, makepoints) {
        this.closed = !!closed;
        this.makepoints = makepoints;
        this.makepoints ??= function(nodes) {
            return structuredClone(nodes);
        };
    }
}
class ToyPlayer {
// a class for node-based interactive toys.
// - or, equally often, to test functions that are difficult to test. to account
//   for lots of different inputs, it's best to have something where i can
//   easily play around with the input.
// - but if this sounds horribly vague to you, picture it as something where you
//   can customize a spline curve. you create and add points, shift them around,
//   and look at how that changes the curve. toys tend to be stuff like that.
// =
// - w, h: canvas dimensions
// - nodes: the points the drawing revolves around.
//   - positions are relative to the center of the canvas, so [0, 0] would be at
//     the center.
// - colors
//   - background: color of empty space
//   - fill: color of colored closed shapes, if applicable
//   - node: color of nodes.
//   - stroke: color of the lines between nodes.
//   =
//   - this is also the order it usually draws in.
// - node_r: the radius of the crosses or circles it draws for the nodes.
//   (unselected nodes are drawn as crosses, the selected node is a hollow
//   circle.)
    constructor(container) {
        let i1 = 0;
        //
        this.container = container;
        this.nodes = [];
        this.color = {
            background: "black",
            fill: "orange",
            node: "green",
            stroke: "white",
        };
        this.node_r = 4;
        //
        let string = [];
        for(i1 in ToyPlayer.toys) {
            if(ToyPlayer.toys.hasOwnProperty(i1)) {
                string.push("<option value=\"" + i1 + "\">" + i1 + "</option>");
            };
        }
        string = [
            "<canvas></canvas>",
            "<div name=\"coortext\" style=\font-size: 0.6em\"></div>",
            "<label><select name=\"select\">",
            "\t" + string.join("\n\t"),
            "</select></label>",
            "<br><button>add node</button>",
            "<br><button>delete node</button>",
        ].join("\n");
        this.container.innerHTML = string;
        this.html = htmlrefobj(this.container);
        //console.log(this.html);
        //
        let canvas = this.container.querySelector("canvas");
        this.ctx = canvas.getContext("2d");
        this.w = 256;
        this.h = 256;
        this.coortext();
        //
        this.toy_name = "spline";
        this.nodes = [
            [0, 0],
            [.5, 0],
            [.5, -.5]
        ];
        let temp = Math.min(this.w, this.h)/2;
        for(i1 = 0; i1 < this.nodes.length; i1++) {
            this.nodes[i1] = Points.floor(Points.multiply(this.nodes[i1], temp));
        }
        this.fill_image = null;
        this.selected = 0;
        //
        let _this = this;
        this.html["add node"].onclick = function(e) {
            if(_this.nodes.length === 0) {
                console.log("this shouldn't happen");
                return;
            }
            else if(_this.nodes.length === 1) {
                let pos = Points.add(_this.nodes[0], _this.center);
                // make it relative to the upper left corner instead of the
                // center
                pos = Points.add(pos, _this.center);
                pos = [
                    posmod(pos[0], _this.w),
                    posmod(pos[1], _this.h)
                ];
                // travel halfway across the canvas
                pos = Points.subtract(pos, _this.center);
                // make it relative to the center again
                _this.nodes.push(pos);
            }
            else {
                let pos = Points.add(_this.nodes[_this.selected], PointSet.next(_this.nodes, _this.selected));
                pos = Points.trunc(Points.divide(pos, 2));
                _this.nodes.splice(_this.selected + 1, 0, pos);
            };
            _this.selected++;
            _this.draw(true);
        };
        this.html["delete node"].onclick = function(e) {
            if(_this.nodes.length === 0) {
                console.log("this shouldn't happen");
                return;
            }
            else if(_this.nodes.length === 1) {
                return;
            };
            _this.nodes.splice(_this.selected, 1);
            if(_this.selected) {
                _this.selected--;
            };
            _this.draw(true);
        };
        this.html.select.onchange = function(e) { _this.toy_name = e.target.value; _this.draw(true) };
        //
        this.stroke = null;
        canvas.onmousedown = function(e) {
            let click = Points.subtract(clickxy(e), _this.center);
            _this.coortext(...click);
            _this.stroke = {
                nodeclicked: false,
            };
            for(let i1 = _this.nodes.length - 1; i1 >= 0 && !_this.stroke.nodeclicked; i1--) {
            // search backwards, because it's probably more common to move later
            // nodes than earlier nodes.
                if(Points.length(Points.subtract(click, _this.nodes[i1])) <= _this.node_r) {
                    _this.stroke.nodeclicked = true;
                    _this.selected = i1;
                };
            }
        };
        function mousemove(e, finish) {
            let click = Points.subtract(clickxy(e), _this.center);
            _this.coortext(...click);
            if(!_this.stroke || !_this.stroke.nodeclicked) {
                return;
            };
            let restore = finish ? null : structuredClone(_this.nodes[_this.selected]);
            _this.nodes[_this.selected] = structuredClone(click);
            _this.draw(finish);
            if(finish) {
                _this.stroke = null;
            }
            else {
                _this.nodes[_this.selected] = structuredClone(restore);
            };
        };
        canvas.onmousemove = function(e) { mousemove(e, false) };
        canvas.onmouseup = function(e) { mousemove(e, true) };
        //
        this.draw(true);
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
    get center() {
        return Points.floor(Points.divide([this.w, this.h], 2));
    }
    get toy() {
        return ToyPlayer.toys[this.toy_name];
    }
    static toys = {
        open: new Toy(false, null),
        closed: new Toy(true, null),
        spline: new Toy(false, function(nodes) {
            if(nodes.length === 0) {
                return [];
            }
            else if(nodes.length === 1) {
                return structuredClone(nodes);
            };
            let points = [];
            let fineness = 16;
            let length = (nodes.length - 1)*fineness;
            for(let i1 = 0; i1 <= length; i1++) {
                points.push(PointSet.spline(nodes, i1/length));
            }
            return points;
        }),
        /*
        arcs: new Toy(false, function(nodes) {
            if(nodes.length < 3) {
                return [];
            };
            let points = [];
            for(let i1 = 0; i1 + 2 < nodes.length; i1 += 2) {
                points.push(structuredClone(nodes[i1]));

            }
            points.push(structuredClone(nodes[nodes.length - 1 - !(nodes.length%2)]));
        }),
        //*/
    }
    draw(refill) {
    // refreshes the visuals.
    // - refill: if true and it's a closed shape, it'll recreate the fill image.
    //   (this should be done on mouseup, but not mousemove. sorta intensive.)
        let i1 = 0;
        let nodes = this.nodes;
        let toy = this.toy;
        let points = toy.makepoints(nodes);
        let dim = [this.w, this.h];
        let center = this.center;
        let ctx = this.ctx;
        ctx.clearRect(0, 0, ...dim);
        ctx.fillStyle = this.color.background;
        ctx.fillRect(0, 0, ...dim);
        ctx.fillStyle = this.color.node;
        ctx.strokeStyle = this.color.node;
        let r = this.node_r;
        for(i1 = 0; i1 < nodes.length; i1++) {
            let pos = Points.add(nodes[i1], center);
            if(i1 === this.selected) {
                circledraw(ctx, ...pos, r, false);
            }
            else {
                ctx.fillRect(pos[0] - r, pos[1], 2*r + 1, 1);
                ctx.fillRect(pos[0], pos[1] - r, 1, 2*r + 1);
            }
        }
        if(toy.closed) {
            ctx.fillStyle = this.color.fill;
            if(refill) {
                this.fill_image = RasterRect.shape(points, true);
                this.fill_image.x += center[0];
                this.fill_image.y += center[1];
            };
            RasterRect.draw(this.fill_image, ctx);
        };
        for(i1 = 0; i1 < points.length - Number(!toy.closed); i1++) {
            ctx.strokeStyle = this.color.stroke;
            linespecial(ctx, ...Points.add(points[i1], center), ...Points.add(PointSet.next(points, i1), center), center);
        }
    }
    coortext(line1, line2) {
        let numstring = (num) => (num > 0 ? "+" : "") + num;
        let max = 0;
        for(let i1 = 0; i1 < 4; i1++) {
            let axis = Math.floor(i1/2);
            let num = (i1%2 ? (axis ? this.h : this.w) : 0) - this.center[axis];
            max = Math.max(max, numstring(num).length);
        };
        // maximum number of digits (i guess the sign isn't a digit, but shut up.)
        let align = function(num) {
            num = numstring(num);
            return "&#160;".repeat(Math.max(0, max - num.length)) + num;
        };
        if(Number.isInteger(line1)) {
            line1 = align(line1) + " x";
        };
        if(Number.isInteger(line2)) {
            line2 = align(line2) + " y";
        };
        this.html.coortext.innerHTML = (line1 ?? "") + "<br>" + (line2 ?? "");
    }
}
//
function crosssection(points, quat, center) {
// returns a _2dPoly cross section of the shape that would be made by convexing
// the given 3d points.
// - points should NOT be the kind of shape Raster.from3d is designed around. if
//   you wanna use it on those, do it for each individual point group, and run
//   addspheroids first.
// - quat, center: combined, this represents the cutting plane.
//   - the z axis of the quaternion is the direction it faces. the x and y axes
//     are used for the _2dPoly. (ie, if a point of the cross section is [3, 7],
//     that means you start at center, move 3 units if the quaternion x axis'
//     direction, 7 units in the quaternion's y axis direction.)
	let i1 = 0;
	let i2 = 0;
	let plane = new Line(...center, Angle.get(...Quat.basis(quat)[2])).plane();
	let shape = [];
	// what it returns in the end
	let side1 = [];
	let side2 = [];
	// lists of point indexes.
	// - side1 is the points on one side of the plane, side2 is the other.
	for(i1 = 0; i1 < points.length; i1++) {
		let sign = Math.sign(roundspecial(plane.pointtotal(points[i1])));
		if(sign === -1) {
			side1.push(i1);
		}
		else if(sign === 0) {
			shape.push(structuredClone(points[i1]));
		}
		else if(sign === 1) {
			side2.push(i1);
		}
		else {
			console.log("this shouldn't happen");
		};
	}
	for(i1 = 0; i1 < side1.length; i1++) {
		for(i2 = 0; i2 < side2.length; i2++) {
            let line = Line.frompoints(points[ side1[i1] ], points[ side2[i2] ]);
            shape.push(line.planeintersect(plane));
		}
	}
    // iterate between every combination of points that are on opposite sides of
    // the plane, and find where the line between them intersects the plane.
	let unquat = Quat.invert(quat);
	for(i1 = 0; i1 < shape.length; i1++) {
		let point = Points.subtract(shape[i1], center);
        point = Quat.apply(unquat, point);
        if(roundspecial(point[2])) {
            console.log("this shouldn't happen");
        }
		shape[i1] = point.slice(0, 2);
	}
    // make it relative to the center, and reverse the orientation of the plane
    // to convert it to quaternion x/y units.
	return shape.length < 3 ? [] : _2dPoly.convexed(shape);
}
function shapeslices(points, quat, center, slice_count, slice_spacing, convert) {
// returns cross sections of the shape that would be made by convexing the given
// 3d points.
// - returned object:
//   - slice: array of arrays of 3d points. outlines of each slice.
//   - pos, neg: points that are outside of all the slices. not on any slice,
//     and not between any slices. useful when connecting slices to form 3d
//     sectors.
// - points should NOT be the kind of shape Raster.from3d is designed around. if
//   you wanna use it on those, do it for each individual point group, and run
//   addspheroids first.
// - quat, center: combined, this represents the cutting plane. the z axis of
//   the quaternion is the direction it faces.
// - slice_count, slice_spacing: number of cuts, and how much the cutting plane
//   should move in its z direction between cuts.
//   - i don't feel like accounting for negative slice_spacing. don't do it.
// - convert: if true, it'll convert all points to 2d.
//   - the x and y axes of the quaternion are used for this. if a 2d point is
//     [3, 7], that means you start at center, move three units in the x
//     direction, 7 in the y direction, and slice_index*slice_spacing in the z
//     direction. that gets you to the 3d position it used to have.
	let i1 = 0;
    let i2 = 0;
	let i3 = 0;
    let unquat = Quat.invert(quat);
    let toplanespace = (point, center) => Quat.apply(unquat, Points.subtract(point, center));
    let fromplanespace = (point, center) => Points.add(center, Quat.apply(quat, [point[0], point[1], point[2] ?? 0]));
    //
    let z_vect = Quat.basis(quat)[2];
    let z_angle = Angle.get(...z_vect);
    slice_count = typeof slice_count === "number" && slice_count > 0 ? slice_count : 1;
    if(slice_spacing < 0) {
        console.log("don't use negative slice_spacing numbers. i didn't account for that.");
        // you probably just switch obj pos and neg and reverse the slice array,
        // but i have no reason to bother with that.
        return;
    };
    slice_spacing = typeof slice_spacing === "number" && slice_spacing > 0 ? slice_spacing : 1;
    let _points = structuredClone(points);
    // it's gonna edit this, so make a duplicate. that way, object reference
    // won't screw the user
    let obj = {pos: [], neg: [], slices: []};
    for(i1 = 0; i1 < slice_count; i1++) {
        let pos = [];
        // points on the positive side of the cutting plane
        let neg = [];
        // points on the negative side
        let slice = [];
        let _center = Points.add(center, Points.multiply(z_vect, i1*slice_spacing));
        for(i2 = 0; i2 < _points.length; i2++) {
            let sign = Math.sign(roundspecial(toplanespace(_points[i2], _center)[2]));
            // use this instead of plane.pointsign, because pos and neg have to
            // represent being in the positive/negative direction of the plane's
            // z axis.
            let array = sign === -1 ? neg : sign === 0 ? slice : sign === 1 ? pos : null;
    		if(array) {
                array.push(structuredClone(_points[i2]));
            }
            else {
    			console.log("this shouldn't happen");
                //console.log(" " + _points[i2]);
                //console.log(" " + plane.pointtotal(_points[i2]));
    		};
    	}
        let plane = new Line(..._center, z_angle).plane();
    	for(i2 = 0; i2 < pos.length; i2++) {
    		for(i3 = 0; i3 < neg.length; i3++) {
            // round robin through all combinations of points that are on
            // opposite sides of the plane. find where the line between them
            // intersects the plane, and add that to the slice.
                slice.push(Line.frompoints(pos[i2], neg[i3]).planeintersect(plane));
    		}
    	}
        //
        for(i2 = 0; i2 < slice.length; i2++) {
            slice[i2] = toplanespace(slice[i2], _center).slice(0, 2);
        }
        slice = slice.length < 3 ? [] : _2dPoly.convexed(slice);
        for(i2 = 0; i2 < slice.length; i2++) {
            slice[i2] = fromplanespace(slice[i2], _center);
        }
        // _2dPoly.convexed is necessary, to avoid redundant points. but, it has
        // to be converted back to 3d points.
        obj.slices.push(structuredClone(slice));
        if(i1 === 0) {
            obj.neg = structuredClone(neg);
        };
        if(i1 === slice_count - 1) {
            obj.pos = structuredClone(pos);
        };
        _points = structuredClone(pos).concat(structuredClone(slice));
        // get rid of all points on the negative side. that way, there's less
        // points to round-robin through next iteration.
    }
    if(convert) {
    // convert to 2d.
        for(i1 = -2; i1 < slice_count; i1++) {
            let array = i1 === -2 ? obj.pos : i1 === -1 ? obj.neg : obj.slices[i1];
            for(i2 = 0; i2 < array.length; i2++) {
                let point = toplanespace(array[i2], center);
                if(i1 >= 0 && roundspecial(point[2] - i1*slice_spacing)) {
                // and if it's a slice, z should be index * spacing. if it
                // isn't, something went wrong.
                    console.log("this shouldn't happen");
                }
                array[i2] = point.slice(0, 2);
            }
        }
    }
	return obj;
}

class Animator {
// a class that creates an animation player.
// - structure:
//   - container: the <div> everything is put in.
//   - canvas, ctx: the canvas the animation is displayed on, and the context
//     for editing it.
//   - w, h: linked to the dimensions of the canvas. NOTE: changing these will
//     wipe the current animation.
//   - frames: array of ImageDatas. it animates by using putImageData with
//     this. NOTE this should never be empty.
//   - frame: number for which frame is displayed.
//   - playing: boolean for if it's playing. clicking the canvas turns this on
//     or off.
//   - interval: used for setInterval
//   - html: object storing references to all relevant elements.
//   - the property names are the element names after a .replaceAll(" ", "_").
//   - animation settings
//     - each animation setting is something like this:
//       - _fps: fps number
//       - get fps, set fps: getters/setters that avoid invalid values, and
//         update input elements
//       - html.fps: input element that lets the user change the fps
//     =
//     - fps (frames per second, number input)
//     - loop (checkbox)
//     - pingpong (checkbox, makes it go back and forth)
//   - reverse: boolean. used in pingpong, to tell if it's in the second half.
//   - other elements
//     - play (button)
//     - prev, next (buttons that tick the frame up/down while it's paused.)
//     - sheet (canvas inside a <details>, showing all the frames. .updatesheet
//       updates it.)
//     - save frame (button that saves an image of the frame)
//     - save sheet (button that saves an image of the sheet)
//   - filename: used when saving images.
//     - write "*frame", and it'll replace that with " frame" if it's saving a
//       frame, or nothing if it's saving the sheet.
//     - write "*sheet", and it'll replace that with " sheet" if it's saving the
//       sheet, nothing if it's saving a frame.
//     - write "*date", and it'll replace that with the date, in YYYY_MM_DD
//       form.
//     - it'll add ".png", so don't bother writing that.
//   - sheet: another object of html references, for a <details> at the end,
//     with a spritesheet inside.
//     - details: the <details> it's all inside. hide this if you don't want any
//       sheet-related stuff.
//     - canvas
//     - wrap: input for how many wide a row gets before it moves on to the next
//       row.
//     - vertical: checkbox for switching the axes of the spritesheet.
//     - save: button that saves the image.
//   - sheet_ctx: ctx of sheet.canvas.
// - custom html system:
//   - every html element except the canvas and the sheet <details>, including
//     animation settings elements, is optional.
//   - the html argument of the constructor should be a string array.
//   - you pretty much just write your own html code. it's useful for adding
//     extra settings or buttons related to updates to the animation.
//   - but it'd be annoying to have to write all the standard stuff (fps, loop,
//     etc) manually.
//   - that's why it's an array. if you write something like "#fps" as an array
//     item, it'll insert the premade code in Animator.template_elements.
//   - NOTE: if you use a name that happens to be a template_elements property,
//     it'll be expected to be the same kind of thing.
//     - so, you can use "fps" as a name... but only if you're just changing how
//       that input element is written. it'll be expected to be a number input,
//       and it'll still be tied to .fps.
    static template_elements = {
        play: "<button name=\"play\" style=\"width: 4em\">play</button>",
        prev: "<button name=\"prev\">&#160;&#60;&#160;</button>",
        next: "<button name=\"next\">&#160;&#62;&#160;</button>",
        fps: "<label><input type=\"number\" name=\"fps\" style=\"width: 3em\" value=12> fps</label>",
        loop: "<label><input type=\"checkbox\" name=\"loop\"> loop</label>",
        pingpong: "<label><input type=\"checkbox\" name=\"pingpong\"> pingpong</label>",
        save_frame: "<button name=\"save frame\">save frame</button>",
    }
    static template_html = [
        "#play", " ", "#prev", " ", "#next",
        "\n<br>", "#fps",
        "\n<br>", "#loop",
        "\n<br>", "#pingpong",
        "\n<br>", "#save_frame"
    ]
    constructor(container, html) {
        let i1 = 0;
        html = Array.isArray(html) ? html : typeof html === "string" ? [html] : Animator.template_html;
        let _html = "";
        let ref = Animator.template_elements;
        for(i1 = 0; i1 < html.length; i1++) {
        // do the # replacement
            let temp = html[i1].startsWith("#") ? html[i1].slice(1) : "";
            _html += (temp && temp in ref) ? ref[temp] : html[i1];
        }
        this.container = container;
        _html = "<canvas></canvas>" + (_html ? "\n<br>" : "") + _html;
        _html += "\n<details>\n\t" + [
            "<summary>sheet</summary>",
            "<ul>",
            "\t<label><input type=\"number\" style=\"width: 3em\" value=4 min=0> wrap</label>",
            "\t<br><label><input type=\"checkbox\"> vertical</label>",
            "\t<br><canvas></canvas>",
            "\t<br><button>save</button>",
            "</ul>"
        ].join("\n\t") + "\n</details>";
        container.innerHTML = _html;
        // write the html
        this.canvas = container.querySelector("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.frames = [];
        this.ctx.clearRect(0, 0, this.w, this.h);
        this.frames.push(this.ctx.getImageData(0, 0, this.w, this.h));
        this._frame = 0;
        this._playing = false;
        this.interval = null;
        this.html = {};
        this._fps = Animator.default_fps;
        this._loop = false;
        this._pingpong = false;
        this.reverse = false;
        this.filename = "anim *date*sheet";
        this.sheet = {};
        this.sheet_ctx = null;
        // create all the properties
        // - avoid running the w/h setters or writeframe. those run functions it
        //   isn't ready for
        let temp = container.querySelectorAll("details");
        this.sheet.details = temp[temp.length - 1];
        let list = htmldescendants(container);
        let sheet_list = htmldescendants(this.sheet.details);
        for(i1 = 0; i1 < list.length; i1++) {
            let ref = list[i1];
            let name = (ref.name ?? "").replaceAll(" ", "_");
            if(sheet_list.includes(ref)) {
                name = "";
                let type = ref.tagName.toLowerCase();
                if(type === "canvas") {
                    name = type;
                }
                else if(type === "label") {
                    name = ref.innerText;
                    ref = ref.children[0];
                }
                else if(type === "button") {
                    name = ref.innerText;
                };
                name = name.trim().toLowerCase().replaceAll(" ", "_");
                if(name) {
                    this.sheet[name] = ref;
                };
            }
            else if(name) {
                this.html[name] = list[i1];
            };
        }
        this.sheet_ctx = this.sheet.canvas.getContext("2d");
        this.updatesheet();
        // create references, set up the sheet
        let _this = this;
        this.canvas.onclick = function(e) {
            _this.playing = !_this.playing;
        }
        if("play" in this.html) {
            this.html.play.onclick = function(e) {
                _this.playing = !_this.playing;
            }
        }
        if("prev" in this.html) {
            this.html.prev.onclick = function(e) {
                if(!_this.loop && !_this.pingpong && _this.frame === 0) {
                    return;
                };
                _this.advance(_this, true);
            }
        }
        if("next" in this.html) {
            this.html.next.onclick = function(e) {
                if(!_this.loop && !_this.pingpong && _this.frame === _this.frames.length - 1) {
                    return;
                };
                _this.advance(_this);
            }
        }
        if("fps" in this.html) {
            this.html.fps.oninput = function(e) {
                let value = readnumber(e.target.value);
                if(value === null || value <= 0 || value === Infinity) {
                    value = Animator.default_fps;
                    e.target.value = value;
                };
                _this.fps = value;
            }
        }
        if("loop" in this.html) {
            this.html.loop.oninput = function(e) {
                _this._loop = e.target.checked;
            }
        }
        if("pingpong" in this.html) {
            this.html.pingpong.oninput = function(e) {
                _this._pingpong = e.target.checked;
                _this.reverse = false;
            }
        }
        if("save_frame" in this.html) {
            this.html.save_frame.onclick = function(e) {
                savecanvas(_this.canvas, _this.filename.replaceAll("*frame", " frame").replaceAll("*sheet", "").replaceAll("*date", filedate()) + ".png");
            }
        }
        this.sheet.wrap.oninput = function(e) {
            _this.updatesheet(_this);
        }
        this.sheet.vertical.oninput = function(e) {
            _this.updatesheet(_this);
        }
        this.sheet.save.onclick = function(e) {
            savecanvas(_this.sheet.canvas, _this.filename.replaceAll("*frame", "").replaceAll("*sheet", " sheet").replaceAll("*date", filedate()) + ".png");
        }
        // event listeners
    }
    get w() {
        return this.canvas.width;
    }
    set w(value) {
        if(this.w !== value && Number.isInteger(value) && value > 0) {
            this.canvas.width = value;
            this.ctx.clearRect(0, 0, this.w, this.h);
            this.frames = [];
            this.writeframe(0);
        }
    }
    get h() {
        return this.canvas.height;
    }
    set h(value) {
        if(this.h !== value && Number.isInteger(value) && value > 0) {
            this.canvas.height = value;
            this.ctx.clearRect(0, 0, this.w, this.h);
            this.frames = [];
            this.writeframe(0);
        }
    }
    get frame() {
        return this._frame;
    }
    set frame(value) {
        let duration = this.frames.length;
        if(!Number.isInteger(value)) {
            console.log("this shouldn't happen");
            value = 0;
        }
        else if(!duration) {
            console.log("this shouldn't happen");
            return;
        }
        this._frame = posmod(value, duration);
        this.refresh();
    }
    get playing() {
        return this._playing;
    }
    set playing(value) {
        if(!!value === this.playing) {
            return;
        }
        this._playing = !!value;
        if(value) {
            let _this = this;
            this.interval = setInterval(function(e) {
                _this.advance(_this);
                if(!_this.loop && _this.frame === 0) {
                // stop if it's at the end of a loop. (loops end at the first
                // frame, not the last.)
                    _this.playing = false;
                };
            }, 1000/this.fps);
        }
        else {
            clearInterval(this.interval);
            this.interval = null;
        }
        if("play" in this.html) {
            this.html.play.innerHTML = value ? "pause" : "play";
        }
        if("prev" in this.html) {
            this.html.prev.disabled = !!value;
        }
        if("next" in this.html) {
            this.html.next.disabled = !!value;
        }
    }
    static default_fps = 12;
    get fps() {
        return this._fps;
    }
    set fps(value) {
        if(typeof value !== "number" && value !== null) {
            return;
        };
        if(value === null || value <= 0 || value === Infinity) {
            value = Animator.default_fps;
        };
        this._fps = value;
        if("fps" in this.html) {
            this.html.fps.value = value;
        }
        if(this.playing) {
        // reset the interval
            this.playing = false;
            this.playing = true;
        };
    }
    get loop() {
        return this._loop;
    }
    set loop(value) {
        this._loop = !!value;
        if("loop" in this.html) {
            this.html.loop.checked = !!value;
        }
    }
    get pingpong() {
        return this._pingpong;
    }
    set pingpong(value) {
        this._pingpong = !!value;
        if("pingpong" in this.html) {
            this.html.pingpong.checked = !!value;
        }
    }
    writeframe(frame, ctx, x, y) {
    // saves a canvas image into the .frames array.
    // - NOTE: this should only be used for one-frame updates. it runs
    //   updatesheet at the end, that's wasteful if you're updating every frame
    //   at once.
    // - all this does besides edit the frames array is make sure there's no
    //   empty slots, (fills them with transparent frames) and run updatesheet
    //   to make sure it doesn't fall behind.
    // - as long as both of those are covered, you can just edit the frames
    //   array directly.
    // =
    // - frame: index
    // - ctx: ctx to copy from
    // - x, y: coordinates of the upper left corner of the frame
        ctx ??= this.ctx;
        x ??= 0;
        y ??= 0;
        let image = ctx.getImageData(x, y, this.w, this.h);
        if(frame >= this.frames.length + 1) {
            this.ctx.clearRect(0, 0, this.w, this.h);
            for(let i1 = this.frames.length; i1 < frame; i1++) {
                this.frames.push(ctx.getImageData(0, 0, this.w, this.h));
            }
            ctx.putImageData(image, 0, 0);
        }
        this.frames[frame] = image;
        this.updatesheet();
    }
    advance(_this, backward) {
    // ticks the animation forward one frame, and switches direction for
    // pingpong.
    // - the end-of-nonloop pausing happens in the interval function.
    // - the way it avoids previous/next frame looping around when loop is off
    //   happens in those buttons' event listeners.
    // - backward: used for the previous frame button.
        _this ??= this;
        let duration = _this.frames.length;
        if(_this.pingpong && duration > 2) {
            _this.frame += (
                _this.frame === 0 ? 1 :
                _this.frame === duration - 1 ? -1 :
                // when it's at the ends, backward and forward are the same
                // direction.
                // - just so you know, it IS possible for reverse to be off when
                //   it's on the last frame. since turning pingpong on or off
                ///  turns off reverse. so be careful about that if you reword
                //   this.
                invertboolean(_this.reverse, backward) ? -1 : 1
            );
            _this.reverse = _this.frame === 0 ? false : _this.frame === duration - 1 ? true : _this.reverse;
            // switch directions.
            //
            // a proper pingpong is like:
            // - 0 / forward
            // - 1 / forward
            // - 2 / forward
            // - 3 / backward
            // - 2 / backward
            // - 1 / backward
            // - 0 / forward (if it isn't looping, end it here.)
        }
        else {
            _this.frame += backward ? -1 : 1;
        }
    }
    refresh(_this) {
    // displays the current frame.
        _this ??= this;
        let duration = _this.frames.length;
        if(!duration) {
            _this.playing = false;
            return;
        };
        _this.ctx.putImageData(_this.frames[_this.frame], 0, 0);
    }
    updatesheet(_this, ctx, wrap, vertical) {
    // updates the sheet.
    // - ctx: use a different canvas instead, for whatever reason
    // - wrap, vertical: overrides the values of this.sheet wrap and vertical.
        _this ??= this;
        let duration = _this.frames.length;
        if(!duration) {
            return;
        };
        ctx ??= _this.sheet_ctx;
        wrap = typeof wrap === "number" ? wrap : Number(_this.sheet.wrap.value);
        wrap = (Number.isInteger(wrap) && wrap > 0) ? wrap : duration;
        vertical ??= _this.sheet.vertical.checked;
        //
        let temp = [wrap, Math.ceil(duration/wrap)];
        if(vertical) {
            temp = [temp[1], temp[0]];
        };
        ctx.canvas.width = temp[0]*_this.w;
        ctx.canvas.height = temp[1]*_this.h;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for(let i1 = 0; i1 < duration; i1++) {
            let coor = [i1%wrap, Math.floor(i1/wrap)];
            if(vertical) {
                coor = [coor[1], coor[0]];
            };
            ctx.putImageData(_this.frames[i1], coor[0]*_this.w, coor[1]*_this.h);
        }
    }
}

class RayViewer {
// probably an improvement on the Viewer class.
// - x, y, z: position of the viewer
// - quat: orientation. -z is the direction it's looking in, x and y are
//   what angles match the screen x and y
// - vp_x, vp_y: vanishing point, relative to the center. i'm not
//   entirely sure how this is implemented, but i have a vague sense of
//   how it works.
// - range: same meaning it has in Viewer. a point can be, at maximum, 180
//   degrees away. this is how many pixels away that would be.
// - scale: .convert returns are multiplied by this.
// - disable: if true, it won't do any perspective conversion at all.
    constructor() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.quat = Quat.new();
        this.vp_x = 0;
        this.vp_y = 0;
        this.range = 180;
        this.scale = 1;
        this.disable = false;
    }
    convert(x, y, z) {
    // tells you where a 3d point should be on the screen, after being
    // perspective-converted.
    // - relative to the center of the screen, to be clear.
    // - it returns 3d coordinates, not 2d. the third coordinate is usually
    //   needed for layering, after all.
        let point = Quat.apply(Quat.invert(this.quat), [x - this.x, y - this.y, z - this.z]);
        // subtract the viewer's position to make it relative to it, do the
        // opposite of what .quat does so you cancel out orientation
        if(!this.disable) {
            point[0] -= this.vp_x;
            point[1] -= this.vp_y;
            // make it relative to the vanishing point
            for(let i1 = 0; i1 < 2; i1++) {
                let num = get2dangle(point[2], point[i1], true) ?? 0;
                if(num >= Math.PI) {
                // make it range from -pi to pi, not 2 to 2*pi
                    num -= 2*Math.PI;
                }
                num *= this.range/Math.PI;
        		// convert to degrees, use the range to convert to pixels
                point[i1] = num;
            }
            point[0] += this.vp_x;
            point[1] += this.vp_y;
        }
        return [this.scale*point[0], this.scale*point[1], point[2]];
    }
    ray(x, y) {
    // each pixel on a screen represents a ray shooting into 3d space, right?
    // this returns a Line of that ray's position and angle.
    // - x and y should be how many pixels away from the center of the screen it
    //   is.
        let point = Points.add([this.x, this.y, this.z], Quat.apply(this.quat, [x/this.scale, y/this.scale, 0]));
        if(this.disable) {
            return new Line(...point, Angle.get(...Quat.apply(this.quat, [0, 0, -1])));
        };
        let xz = x/this.scale - this.vp_x;
        let yz = y/this.scale - this.vp_y;
        // - divide by scale to cancel it out
        // - subtract vanishing point so angles are measured by how close it is
        //   to that
        xz /= this.range/Math.PI;
        yz /= this.range/Math.PI;
        // - divide by range/pi to convert it from pixels back to angle
        xz += xz < 0 ? 2*Math.PI : 0;
        yz += yz < 0 ? 2*Math.PI : 0;
        // - make sure it ranges between 0 and 2 pi instead of -pi and pi
        let angle = rotate(rotate([0, 0, -1], "xz", xz), "yz", yz);
        angle = Angle.get(...Quat.apply(this.quat, angle));
        return new Line(...point, angle);
    }
}
class Paper {
// a class for creating/displaying backgrounds made of 2d vector shapes oriented
// in 3d space.
// - this class is the "scene", storing all of those shapes, view settings, etc.
// =
// - view settings
//   - viewer: a RayViewer
//     - camera angle
//     - camera position
//     - perspective
//     - scale
//   - dimensions
//   - background color
//   - circle fineness
// - light: object representing a light source.
//   - x, y, z
//   - light_value
//   - light_hue
//   - dark_value
//   - dark_hue
//   =
//   - light_value and dark_value affect how the values of the colors
//     change. if it's negative, color values are divided by the absolute
//     value of this number. if it's positive, their distance from maximum
//     value is divided by this number.
//   - light_hue and dark_hue cause hue shift.
//   - to be clear, this is NOT a full lighting system. it's primarily here
//     to make sure surfaces with the same base color look like slightly
//     different colors depending on how they're oriented.
// - sheets: array of objects representing 2d shapes oriented in 3d space.
//   - color
//   - x, y, z
//   - center_x, center_y: used to calculate its angle to the light source. it
//     uses the plane axes, like the shape points.
//   - quat: orientation quaternion.
//     - the z axis is which direction it faces, the x and y axes are used
//       for plane coordinates. standard fare.
//   - shapes: array of shapes defining what areas of the sheet do and
//     don't exist.
//     - type: what it does
//       - "add": if a point is inside this shape, it isn't a gap. (unless
//         it's inside a later "subtract".)
//       - "subtract": if a point is inside this shape, it's in a gap.
//     - points: points that define the shape.
//       - this is a 2d version of the addspheroids/Raster.from3d system.
//         groups of points and ellipses that get convexed.
//       - a point is [x, y, w, h, angle]
//         - angle being a number from 0 to 2 pi
//         - just like the 3d version, there can be just [x, y, w, h], or [x, y,
//           w], or [x, y]
//   - neighbors: array of sheet indexes that should be directly adjacent
//     to this.
//     - this is technical minutia stuff. it's a way of avoiding crappy
//       ugly edges that have crappy ugly gaps.
    constructor() {
        this.viewer = new RayViewer();
        this.w = 128;
        this.h = 128;
        this.viewer.z += this.w/2;
        this.bg = "black";
        this.fineness = 8;
        this.light = {
            x: 0,
            y: -this.h/2,
            z: 0,
            light_value: 5/4,
            dark_value: -3/4,
        };
        this.sheets = [];
    }
    static Sheet = class {
        constructor(w, h, color) {
            w = typeof w === "number" ? w : 0;
            h = typeof h === "number" ? h : 0;
            this.color = color ?? "silver";
            this.x = 0;
            this.y = 0;
            this.z = 0;
            this.center_x = w/2;
            this.center_y = h/2;
            this.quat = Quat.new();
            this.shapes = [new Paper.Shape("add")];
            this.shapes[0].points.push([
                [0, 0],
                [w, 0],
                [0, h],
                [w, h]
            ]);
            this.neighbors = [];
        }
        get plane() {
            let point = Points.convert(this);
            let basis = Quat.basis(this.quat);
            return Plane.frompoints(
                point,
                Points.add(point, Quat.apply(this.quat, [1, 0, 0])),
                Points.add(point, Quat.apply(this.quat, [0, 1, 0]))
            );
        }
        tosheetspace(point) {
        // converts a 3d coordinate to the coordinates within a sheet.
        // - subtracts [this.x, this.y, this.z]
        // - does the opposite of the rotation this.quat does
        // - "sheet space" is what shape coordinates are measured in. a point at
        //   [3, 7] means 3 in the Sheet's x direction, not x itself, and 7 in
        //   the sheet's y direction, not y itself.
        // - the third coordinate is usually irrelevant, but it's still
        //   included. layering. making sure it's actually on the plane. stuff
        //   like that.
        //   - right. the third coordinate is equivalent to
        //     this.plane.pointtotal(point).
        //     - it might have an opposite sign, actually. Plane isn't great
        //       with signs, but this is.
            return Quat.apply(
                Quat.invert(this.quat),
                Points.subtract(point, Points.convert(this))
            );
        }
        fromsheetspace(point) {
        // does the opposite. the input can be 2d or 3d.
            return Points.add(
                Points.convert(this),
                Quat.apply(this.quat, [point[0], point[1], point[2] ?? 0])
            );
        }
    }
    static Shape = class {
        constructor(type, points) {
            this.type = Paper.Shape.types.includes(type) ? type : Paper.Shape.types[0];
            this.points = Array.isArray(points) ? points : [];
        }
        static types = ["add", "subtract"]
    }
    render(ctx) {
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let i4 = 0;
        ctx.canvas.width = this.w;
        ctx.canvas.height = this.h;
        ctx.clearRect(0, 0, this.w, this.h);
        ctx.fillStyle = this.bg;
        ctx.fillRect(0, 0, this.w, this.h);
        let raster = {
            sheet: [],
            // - [sheet indexes]: _2dPoly.getdata for this whole sheet
            shape: [],
            // - [sheet indexes]
            //   - [shape indexes]: _2dPoly.getdata for this whole shape
            single: [],
            // - [sheet indexes]
            //   - [shape indexes]
            //     - [group indexes]: _2dPoly.getdata for this group
            scale: this.viewer.scale,
        };
        let shapes = [];
        // - [sheet index]
        //   - [shape index]
        //     - [group indexes]: _2dPoly for this shape group, convexed.
        for(i1 = 0; i1 < this.sheets.length; i1++) {
        // for every sheet
            let rect = null;
            raster.sheet[i1] = null;
            raster.shape[i1] = [];
            raster.single[i1] = [];
            shapes[i1] = [];
            let ref = this.sheets[i1].shapes;
            for(i2 = 0; i2 < ref.length; i2++) {
            // for every shape
                raster.shape[i1][i2] = null;
                raster.single[i1][i2] = [];
                shapes[i1][i2] = [];
                for(i3 = 0; i3 < ref[i2].points.length; i3++) {
                // for every group within a shape
                    raster.single[i1][i2][i3] = null;
                    shapes[i1][i2][i3] = null;
                    let _ref = ref[i2].points[i3];
                    let points = [];
                    for(i4 = 0; i4 < _ref.length; i4++) {
                    // convert the points to 3d, so addspheroids can use it
                        let point = _ref[i4];
                        if(point.length < 2) {
                            console.log("this shouldn't happen");
                        }
                        else {
                            points.push(
                                point.length >= 5 ? [point[0], point[1], 0, point[2], point[3], 0, Quat.new("xy", point[4])] :
                                // the Points.multiply will multiply the angle,
                                // too. that makes no sense, so avoid that by
                                // referencing the original value.
                                point.length === 4 ? [point[0], point[1], 0, point[2], point[3], 0] :
                                point.length === 3 ? [point[0], point[1], 0, point[2], point[2], 0] :
                                [point[0], point[1], 0]
                            );
                        }
                    }
                    points = addspheroids(points, this.fineness);
                    for(i4 = 0; i4 < points.length; i4++) {
                        points[i4] = [raster.scale*points[i4][0], raster.scale*points[i4][1]];
                    }
                    shapes[i1][i2][i3] = _2dPoly.convexed(points);
                    points = shapes[i1][i2][i3];
                    raster.single[i1][i2][i3] = _2dPoly.getdata(points, true);
                }
                raster.shape[i1][i2] = _2dPoly.mergedata(raster.single[i1][i2]);
                let data = raster.shape[i1][i2];
                data.outline = Raster.outline(data.within, data.rect.w, true);
                for(i3 = 0; i3 < raster.single[i1][i2].length; i3++) {
                    data = raster.single[i1][i2][i3];
                    data.outline = Raster.outline(data.within, data.rect.w, true);
                }
                rect = rect ? Rect.contain(rect, data.rect) : Rect.new(data.rect.x, data.rect.y, data.rect.w, data.rect.h);
            }
            let within = [];
            let l = null;
            let r = null;
            let u = null;
            let d = null;
            for(i2 = 0; i2 < rect.w*rect.h; i2++) {
            // for every pixel that could be inside the main sheet...
                let coor = Rect.getcoor(rect, i2);
                if(coor) {
                    let bool = false;
                    let array = raster.shape[i1];
                    for(i3 = 0; i3 < array.length; i3++) {
                    // iterate through every shape to see if this pixel should
                    // be filled or not.
                        let type = this.sheets[i1].shapes[i3].type;
                        if(
                            type === "add" ? !bool :
                            type === "subtract" ? bool :
                            false
                        ) {
                            let index = Rect.getindex(array[i3].rect, ...coor);
                            if(index === -1) {
                            // out of bounds, even though the sheet rect is
                            // the sum of all shape rects.
                                console.log("this shouldn't happen");
                            }
                            else if(array[i3].within[index]) {
                                bool = !bool;
                            };
                        }
                    }
                    // Rect.getindex(rect, ...coor)
                    within.push(bool);
                    if(bool) {
                        l = l === null ? coor[0] : Math.min(l, coor[0]);
                        r = r === null ? coor[0] + 1 : Math.max(r, coor[0] + 1);
                        u = u === null ? coor[1] : Math.min(u, coor[1]);
                        d = d === null ? coor[1] + 1 : Math.max(d, coor[1] + 1);
                    };
                }
                else {
                    console.log("this shouldn't happen");
                }
            }
            raster.sheet[i1] = {};
            ref = raster.sheet[i1];
            ref.rect = Rect.fromedges(l, r, u, d);
            ref.within = [];
            for(i2 = 0; i2 < ref.rect.w*ref.rect.h; i2++) {
                let _i2 = Rect.convertindex(ref.rect, rect, i2);
                if(_i2 === -1) {
                    console.log("this shouldn't happen");
                    ref.within[i2] = false;
                }
                else {
                    ref.within[i2] = within[_i2];
                };
            };
            ref.outline = Raster.outline(ref.within, ref.rect.w, true);
        }
        // all of these rasters are created to save time on the way it checks
        // pixels.
        // - for every single pixel of the screen, it does all of this.
        //   - figure out the Line that represents what a plane has to intersect
        //     to show up on that pixel
        //   - sort the sheets by which sheets' planes the line would intersect
        //     first
        //   - then, for every one of those sheets, figure out if the line
        //     actually intersects it.
        //     - meaning, you iterate through every shape,
        //       - every point group of those shapes,
        //         - every line of those shapes.
        // - granted, some of that is skipped.
        //   - if it hits a fully opaque sheet and verifies that it passes
        //     through it, it doesn't have to check any more sheets.
        //   - it skips shapes if the type doesn't line up.
        //     - it starts with the assumption that it doesn't pass through the
        //       shape.
        //     - then, if it passes through an "add" shape, it assumes it does
        //     - then, if it passes through a "subtract" shape, it assumes it
        //       doesn't.
        //     - so if the assumption is that it doesn't, it skips subtract, and
        //       if the assumption is that is does, it skips add.
        // - but that's still crazy intensive for *every fucking pixel of the
        //   screen.* so. you know.
        // - it would be nice to just copy whatever the hell the _2dPoly says!
        //   it'd save a lot of time.
        // - but that doesn't quite work either. because of perspective, one
        //   pixel of a plane can be way more than one pixel on the screen. if
        //   the sheet is too close, it'll look blocky.
        // - so instead, the way it works is, if it hits the OUTLINE of the
        //   _2dPoly raster, it has to actually do the math. but otherwise, it
        //   can just copy the _2dPoly data.
        let planes = [];
        let colors = [];
        for(i1 = 0; i1 < this.sheets.length; i1++) {
            //console.log("lrudbf"[i1]);
            let ref = this.sheets[i1];
            planes.push(ref.plane);
            // this sounds unnecessary, since you could just use
            // this.sheets[i1].plane later on and the code is fairly simple, but
            // keep in mind that would make the plane getter run
            // this.w*this.h*this.sheets.length times. if you do it ahead of
            // time, it runs this.sheet.length times.
            let angle = Angle.get(...Quat.apply(ref.quat, [0, 0, 1]));
            let center = ref.fromsheetspace([ref.center_x, ref.center_y, 0]);
            //console.log(center);
            //let center = Points.add(Points.add(point, Points.multiply(ref.center_x, basis[0])), Points.multiply(ref.center_y, basis[1]))
            let _angle = Angle.get(...Points.subtract(Points.convert(this.light), center));
            let compare = Angle.compare(angle, _angle);
            let alpha = colortohex(ctx, ref.color);
            let color = [];
            for(i2 = 0; i2 < 3; i2++) {
                color.push(parseInt(alpha.slice(1 + 2*i2, 3 + 2*i2), 16)/255);
            }
            alpha = alpha.slice(7);
            let value = this.light[compare < Math.PI/2 ? "light_value" : "dark_value"];
            let effect = compare < Math.PI/2 ? Math.cos(compare) : 1;
            if(value) {
                let _color = (
                    value < 0 ? Points.divide(color, -value) :
                    value > 0 ? Points.subtract(
                        [1, 1, 1],
                        Points.multiply(
                            Points.subtract([1, 1, 1], color),
                            1 - 1/value
                        )
                    ) :
                    color
                );
                for(i2 = 0; i2 < 3; i2++) {
                    _color[i2] = Math.max(0, Math.min(_color[i2], 1));
                    color[i2] = effect*_color[i2] + (1 - effect)*color[i2];
                }
            }
            for(i2 = 0; i2 < 3; i2++) {
                color[i2] = numtohex(Math.round(255*color[i2]), 2);
            }
            color = "#" + color.join("") + alpha;
            colors.push(color);
        }
        let ctx_rect = Rect.new(0, 0, this.w, this.h);
        for(i1 = 0; i1 < this.w*this.h; i1++) {
            let log = [0, this.w - 1, this.w*this.h - this.w, this.w*this.h - 1].includes(i1);
            let coor = Rect.getcoor(ctx_rect, i1);
            let ray = this.viewer.ray(
                coor[0] - this.w/2 + .5,
                coor[1] - this.h/2 + .5
            );
            if(log) {
                console.log("ray:");
                console.log("\t" + Points.convert(ray));
                console.log("\t" + Angle.numbers(ray.angle));
            };
            let intersect = [];
            // {point, index}
            for(i2 = 0; i2 < this.sheets.length; i2++) {
                let plane = planes[i2];
                let point = ray.planeintersect(plane);
                if(point) {
                    let place = roundspecial(ray.findplace(point));
                    if(place > 0) {
                        intersect.push({point, place, index: i2});
                    }
                };
            }
            if(intersect.length) {
                intersect.reverse();
                // reverse the order before you sort it.
                // - why? for the sake of building onto sheets. for example, if
                //   you make a dresser with them, you might want to make sheets
                //   for the drawers, to add detail.
                // - but the drawers aren't a 3d feature. while closed, their
                //   plane lines up perfectly with the plane for the front face
                //   of the dresser.
                // - so, if it just looks for the first, closest sheet that
                //   intersects the line... both are equal, so it'll choose
                //   whichever was earlier in the array, when it should choose
                //   whichever was later.
                intersect.sort((a, b) => a.place - b.place);
                let _colors = [];
                for(i2 = 0; i2 < intersect.length; i2++) {
                    let _i2 = intersect[i2].index;
                    let sheet = this.sheets[_i2];
                    let point = sheet.tosheetspace(intersect[i2].point);
                    let ref = {
                        sheet: raster.sheet[_i2],
                        shape: raster.shape[_i2],
                        single: raster.single[_i2],
                    };
                    let _point = [Math.floor(point[0]/raster.scale), Math.floor(point[1]/raster.scale)];
                    let index = Rect.getindex(ref.sheet.rect, ..._point);
                    if(index !== -1) {
                        let bool = ref.sheet.within[index];
                        if(ref.sheet.outline[index]) {
                            //
                        };
                        if(bool) {
                            _colors.splice(0, 0, colors[_i2]);
                            let format = Color.format(colors[_i2]);
                            if(format === "hex6") {
                                i2 += intersect.length;
                                // fully opaque intersection; don't bother
                                // checking the rest of the intersections.
                            }
                            else if(format === "hex8") {
                                if(colors[_i2].endsWith("ff")) {
                                    i2 += intersect.length;
                                }
                            }
                            else {
                                console.log("this shouldn't happen");
                            };
                        };
                    };
                }
                for(i2 = 0; i2 < _colors.length; i2++) {
                    ctx.fillStyle = _colors[i2];
                    ctx.fillRect(...coor, 1, 1);
                }
            }
        }
    }
}
class FloorPlan {
// a class for making simple floor plans, with rectangular rooms. it uses a
// script system.
// - structure:
//   - levels: array of FloorPlan.Level objects.
// - structure of a Level:
//   - x_grid, y_grid, areas
//     - coordinates in FloorPlan use Frac, meaning they're stored as fractions.
//       an array of a numerator and denominator.
//     - but on top of that, there's a sort of unconventional grid system.
//     - almost all actions in FloorPlan are extrusions or intrusions, to create
//       new rooms, or alter existing rooms' shape.
//     - even with just that, rooms and their walls can get very complex. but no
//       matter how complex they get, they can be broken down into a lot of
//       rectangles.
//     - x_grid and y_grid are arrays of Fracs for every possible coordinate
//       room boundaries can have. it's like a set of grid lines, except they
//       aren't evenly spaced. they can be placed anywhere. every time a new
//       corner is made, like the corners of a rectangular room, or the corners
//       of an extrusion, those are added to x_grid and y_grid.
//     - this divides space into a bunch of rectangles that we know for sure
//       every room is made of one or more of.
//     - areas is an array of strings for which rectangle sectors belong to
//       which rooms. it's ordered from left to right, then top to bottom.
//       areas[0] is which room the top left rectangle belongs to, areas[1] is
//       the rectangle to the right of that, etc.
//       - remember, the number of rectangles in a row is one LESS than the
//         number of x_grid Fracs, and the same goes for the rectangles in a
//         column and y_grid blah blah blah.
//       - an empty string means it's empty space.
//   - doors: an object storing where doors are.
//     - structure:
//       - [room names]
//         - [array indexes]
//           - side: name of the side (ex: "r", "d2", etc)
//   - cache: stores data that's created entirely from the other properties,
//     kept around to prevent redundant calculations.
//     - structure:
//       - indexrect
//         - [room names] (values are room_indexrect returns)
//       - raster
//         - [room names] (values are room_raster returns)
//       - sides
//         - [room names] (values are room_sides returns)
    static manual = [
        "floor plans are written by starting from a rectangle and creating various extrusions or intrusions. for brevity's sake, they're called edits.",
        "edits can move a whole wall or part of a wall, and they can create new rooms or just modify the shape of existing rooms.",
        "it sounds limited, but as long as a building doesn't have circular rooms or anything similarly artsy, it can be made with this system.",
        "relying on extrusions/intrusions also makes it so doors don't have to be placed manually.",
        "to start a floor, you create a room from scratch by writing something like \"hall: d door 3 w 2 h 0 x 0 y\".",
        [
            "the direction of the door, the width and height, and the position of the center.",
            "if position is omitted, it'll assume it's at [0, 0].",
            "if height is omitted, it'll assume it's the same as width.",
            "if the door direction is omitted, it'll assume there is no door.",
            "if a room is created where there are already rooms, it'll only fill space that doesn't have a room.",
            [
                "unless you write \"replace\". that makes it cover space even if it has a room already."
            ]
        ],
        "an edit consists of a line where you specify the name of the new room or the room you're modifying, and indented lines where you specify the details of the edit.",
        [
            "indentation can be done with spaces, not just tabs.",
            "you can create multiple rooms at once by separating the names with slashes. (ex: \"bed 1 / bed 2\") the extrusion/intrusion will be split up evenly, the splits parallel to the extrusion/intrusion direction.",
            "the first indented line describes which wall of which room is being moved, and the position and dimensions of that movement."
            [
                "for example, \"r(bed) 2/3 out 1/2 d\".",
                "\"r(bed)\" means the <b>r</b>ight wall of the room called \"bed\".",
                [
                    "NOTE: it matters which side you refer to it with, because a door is placed between the new room and the room you referenced.",
                    [
                        "let's say the right wall of \"bed\" divides it from a room called \"hall\". meaning, \"r(bed)\" and \"l(hall)\" refer to the same wall.",
                        "when a new room is made, there's two walls, right? there's the section of wall you used, and the version of it that moved. a rectangular room is made by joining that old wall and new wall.",
                        "if you use a wall from bed, it'll make sure the new room has a door to bed. if you use a wall from hall, it'll make sure the new room has a door to hall.",
                        "so it's like this.",
                        [
                            "if you intrude the right wall of bed, the new room will take some of bed's space, and the new wall will have a door.",
                            "if you extrude the right wall of bed, the new room will take some of hall's space, and the old wall will have a door.",
                            "if you intrude the left wall of hall, the new room will take some of hall's space, and the new wall will have a door.",
                            "if you extrude the left wall of hall, the new room will take some of bed's space, and the old wall will have a door."
                        ]
                    ]
                ],
                "\"2/3 out\" means it's being pushed out 2/3 units.",
                "\"1/2 d\" is means the section of wall being moved is only 1/2 units, and it's the 1/2 units at the top of the wall. (d is for <b>d</b>own.)",
                "in some cases, this can all be much more concise.",
                [
                    "if you're modifying a room rather than creating one, you write just the direction letter, \"r\", since you can only move the walls of the room you're modifying.",
                    "if \"d\" is omitted, it will use the section in the center of the given wall.",
                    "if the second number is omitted, it'll assume you're moving the entire wall."
                ]
            ]
        ],
        "all coordinates can be written as fractions or mixed numbers.",
        "editing complex rooms:",
        [
            "\"complex rooms\" is what i call rooms that aren't just rectangular \"simple rooms\". for example, maybe it's shaped like an L or something, or maybe intrusions have eaten away at the shape.",
            "the trouble with complex rooms is that it's difficult to refer to its walls for edits. there's more than just left, right, up, and down.",
            "l, r, u, and d can still be used. they refer to whatever walls are most exterior. picture the smallest rectangle that the shape fits in. l, r, u, and d refer to the walls that align with the sides of that rectangle.",
            "there are instances where multiple walls qualify, however. for example, a C-shaped room. in those instances, you add a number.",
            [
                "r1 refers to the higher right wall. r2 refers to the lower. (for vertical walls, lower numbers mean higher walls. for horizontal walls, lower numbers mean walls closer to the left.)",
                "this syntax is pretty rigid. if there's multiple right walls but you just type \"r\", it'll error, telling you that's wrong. if there's only one right wall but you type r1, it'll also error.",
                "this only happens if there's multiple applicable walls, not just if the walls are incomplete. for example, the right side of an L-shaped room doesn't reach from the top of the room to the bottom, but referring to the right wall is still pretty unambiguous, so you use \"r\" like usual."
            ],
            "at the moment, there are no ways to refer to internal walls."
        ],
        "boring technical details (unimportant for the gist of how to use this, but important for understanding the limits of certain things.)",
        [
            "edits will fail if the area they cover overlaps with more than one existing room. (for this purpose, unused space counts as a \"room\".)",
            "edits will fail if they bisect the room they're intruding in."
        ]
    ]
    static validname(name) {
    // returns an error string if the given string is invalid as a room name, an
    // empty string if it's valid
        return (
            trimunspecial(name) !== name ? "name has whitespace besides spaces, or has consecutive spaces, or has spaces at the beginning or end." :
            name.includes("/") ? "names cannot have slashes." :
            ""
        );
    }
    static Level = class {
    // class for one floor of the building.
        constructor() {
            this.x_grid = [];
            this.y_grid = [];
            this.areas = [];
            this.doors = {};
            this.cache = {};
        }
        add_grid(frac, vertical) {
            let i1 = 0;
            let ref = this[(vertical ? "y" : "x") + "_grid"];
            if(!ref.length) {
                ref.push(structuredClone(frac));
                return 0;
            };
            for(i1 = 0; i1 < ref.length; i1++) {
                if(compareobject(frac, ref[i1])) {
                    return i1;
                };
            };
            const num = Frac.num(frac);
            const w = this.x_grid.length - 1;
            if(num < Frac.num(ref[0])) {
                let temp = [0, 0, 0, 0];
                temp[2*(!!vertical)] = 1;
                this.areas = Raster.addrowcol(this.areas, w, ...temp, "");
                ref.splice(0, 0, structuredClone(frac));
                return 0;
            }
            else if(num > Frac.num(ref[ref.length - 1])) {
                let temp = [0, 0, 0, 0];
                temp[1 + 2*(!!vertical)] = 1;
                this.areas = Raster.addrowcol(this.areas, w, ...temp, "");
                ref.push(structuredClone(frac));
                return ref.length - 1;
            };
            //
            let place = -1;
            while(place + 1 < ref.length && num > ref[place + 1]) {
                place++;
            }
            // place is now which index of ref it comes after
            if(place < 0 || place >= ref.length) {
                console.log("this shouldn't happen");
                return;
            };
            const h = this.y_grid.length - 1;
            if(vertical) {
                this.areas = Raster.doublerow(this.areas, w, place);
            }
            else {
                this.areas = Raster.doublecol(this.areas, w, place);
            }
            // duplicate areas
            ref.splice(place + 1, 0, structuredClone(frac));
            return place + 1;
        }
        add_x_grid(frac) {
            return this.add_grid(frac, false);
        }
        add_y_grid(frac) {
            return this.add_grid(frac, true);
        }
        add_xy_grid(frac2) {
            return [
                this.add_grid(frac2.slice(0, 2), false),
                this.add_grid(frac2.slice(2, 4), true)
            ];
        }
        // adds coordinates to x_grid/y_grid and returns the index it's given.
        static simplify_space(space) {
        // input a {x_grid, y_grid, areas} object, and it'll get rid of excess rows
        // and columns.
        // - it can also have h_doors and v_doors.
        // - NOTE: the object is edited directly, rather than returning a modified
        //   version.
        // - if there are rows/columns that are identical to adjacent rows/columns,
        //   they'll be sliced out of all 5 arrays.

        }
        room_indexrect(name) {
        // the edges of the rectangle this gives you represent what indexes of
        // x_grid/y_grid give you the coordinates of the given room's outermost
        // edges.
            let rect = null;
            for(let i1 = 0; i1 < this.areas.length; i1++) {
                let x_index = i1%this.x_grid.length;
                let y_index = Math.floor(i1/this.x_grid.length);
                if(this.areas[i1] === name) {
                    if(rect) {
                        rect = Rect.reach(rect, x_index, y_index);
                        rect = Rect.reach(rect, x_index + 1, y_index);
                        rect = Rect.reach(rect, x_index, y_index + 1);
                        rect = Rect.reach(rect, x_index + 1, y_index + 1);
                    }
                    else {
                        rect = Rect.new(x_index, y_index, 1, 1);
                    };
                };
            }
            return rect;
        }
        room_raster(name, indexrect) {
        // a raster for what areas within the indexrect are actually part of the
        // room.
        // - indexrect: this argument just saves time. if omitted, it'll figure it
        //   out on its own.
            indexrect ??= this.room_indexrect(roomname);
            if(!indexrect) {
                return [];
            };
            let raster = [];
            for(let i1 = 0; i1 < indexrect.w*indexrect.h; i1++) {
                let _i1 = Rect.convertindex(indexrect, Rect.new(0, 0, this.x_grid.length, this.y_grid.length), i1);
                if(_i1 === -1) {
                    console.log("this shouldn't happen");
                };
                raster.push(this.areas[_i1] === name);
            }
            return raster;
        }
        room_sides(name, indexrect, raster) {
        // - returns an object of the sides the room has and what their names are.
        // - structure:
        //   - [side names]
        //     - x_index: which index of x_grid it's on (the left edge of the side,
        //       if it's a horizontal side.)
        //     - y_index: same for y (the top edge of the side, if it's a vertical
        //       side)
        //     - length: number to add to the index to get the other end of the
        //       side. (how many areas it's adjacent to, basically.)
        //     - vertical: boolean.
        // - indexrect, raster: these arguments only save time. if they're unfilled,
        //   it'll figure it out on its own.
            let i1 = 0;
            let i2 = 0;
            indexrect ??= this.room_indexrect(name);
            raster ??= this.room_raster(name, indexrect);
            if(!indexrect || !raster.length) {
                if(indexrect || raster.length) {
                    console.log("this shouldn't happen");
                }
                return {};
            };
            let array = [];
            const w = indexrect.w;
            const h = indexrect.h;
            for(i1 = 0; i1 < raster.length; i1++) {
                if(raster[i1] === name) {
                    let col = i1%w;
                    let row = Math.floor(i1/w);
                    let _array = [];
                    if(col === 0 ? true : !raster[i1 - 1]) {
                        // left side
                        _array.push({
                            x_index: indexrect.x + col,
                            y_index: indexrect.y + row,
                            length: 1,
                            vertical: false,
                        });
                    }
                    else if(col === (w - 1) ? true : !raster[i1 + 1]) {
                        // right side
                        _array.push({
                            x_index: indexrect.x + col + 1,
                            y_index: indexrect.y + row,
                            length: 1,
                            vertical: false,
                        });
                    }
                    else if(col === 0 ? true : !raster[i1 - w]) {
                        // up side
                        _array.push({
                            x_index: indexrect.x + col,
                            y_index: indexrect.y + row,
                            length: 1,
                            vertical: true,
                        });
                    }
                    else if(col === (h - 1) ? true : !raster[i1 + w]) {
                        // down side
                        _array.push({
                            x_index: indexrect.x + col,
                            y_index: indexrect.y + row + 1,
                            length: 1,
                            vertical: true,
                        });
                    };
                    for(i2 = 0; i2 < _array.length; i2++) {
                        let _i2 = _array[i2];
                        let find = array.find((element) => (
                            element.vertical === _i2.vertical
                            &&
                            (element.x_index + !_i2.vertical*element.length) === _i2.x_index
                            &&
                            (element.y_index + _i2.vertical*element.length) === _i2.y_index
                        ));
                        if(find !== -1) {
                            array[find].length += _i2.length;
                        }
                        else {
                            array.push(structuredClone(_i2));
                        };
                    }
                };
            }
            let sides = {};
            let cycles = 0;
            while(array.length) {
                let l = null;
                let r = null;
                let u = null;
                let d = null;
                array.forEach(function(element) {
                    if(element.vertical) {
                        l = l === null ? element.x_index : Math.min(l, element.x_index);
                        r = r === null ? element.x_index : Math.max(r, element.x_index);
                    }
                    else {
                        u = u === null ? element.y_index : Math.min(u, element.y_index);
                        d = d === null ? element.y_index : Math.max(d, element.y_index);
                    };
                });
                // now, l/r/u/d are the x_index/y_index the sides on the edges of
                // the shape should have.
                let _sides = {l: [], r: [], u: [], d: []};
                for(i1 = 0; i1 < array.length; i1++) {
                    let _i1 = array[i1];
                    let remove = false;
                    if(_i1.vertical) {
                        if(_i1.x_index === l) {
                            _sides.l.push(structuredClone(_i1));
                            remove = true;
                        };
                        if(_i1.x_index === r) {
                            _sides.r.push(structuredClone(_i1));
                            remove = true;
                        };
                    }
                    else {
                        if(_i1.y_index === u) {
                            _sides.u.push(structuredClone(_i1));
                            remove = true;
                        };
                        if(_i1.y_index === d) {
                            _sides.d.push(structuredClone(_i1));
                            remove = true;
                        };
                    };
                    if(remove) {
                        array.splice(i1, 1);
                        i1--;
                    };
                };
                for(i1 = 0; i1 < 4; i1++) {
                    let _i1 = "lrud"[i1];
                    let ref = _sides[_i1];
                    if(ref.length === 1) {
                        sides["*".repeat(cycles) + _i1] = structuredClone(ref[0]);
                    }
                    else if(_sides[_i1].length) {
                        for(i2 = 0; i2 < ref.length; i2++) {
                            sides["*".repeat(cycles) + _i1 + (i2 + 1)] = structuredClone(ref[i2]);
                        }
                    }
                    else if(!cycles) {
                        console.log("this shouldn't happen");
                    };
                }
                cycles++;
                if(cycles >= 1000) {
                    console.log("this shouldn't happen");
                    array = [];
                }
            }
            return sides;
        }
        add_room(x, y, w, h, name) {
        // returns a boolean for whether the new room was added successfully.
        // - room creation fails if:
        //   - it covers an existing room completely
        //   - it bisects an existing room
        //   - any existing doors are covered, partially or fully
            let i1 = 0;
            let i2 = 0;
            if(!Frac.num(w) || !Frac.num(h) || FloorPlan.validname(name)) {
            // dimensions are zero, invalid name
                return false;
            };
            let old = new FloorPlan.Level();
            for(i1 in this) {
                if(this.hasOwnProperty(i1)) {
                    old[i1] = structuredClone(this[i1]);
                }
            }
            function reverse() {
                for(let i1 in old) {
                    if(old.hasOwnProperty(i1)) {
                        this[i1] = structuredClone(old[i1]);
                    }
                }
            }
            // back up all data, so changes can be reversed
            let indexrect = [
                this.add_xy_grid([...x, ...y]),
                this.add_xy_grid([...Frac.add(x, w), ...Frac.add(y, h)])
            ];
            indexrect = Rect.fromedges(
                Math.min(indexrect[0][0], indexrect[1][0]),
                Math.max(indexrect[0][0], indexrect[1][0]),
                Math.min(indexrect[0][1], indexrect[1][1]),
                Math.max(indexrect[0][1], indexrect[1][1])
            );
            this.cache.indexrect[name] = structuredClone(indexrect);
            indexrect = this.cache.indexrect[name];
            this.cache.raster[name] = [];
            let replaced = [];
            for(i1 = 0; i1 < indexrect.w*indexrect.h; i1++) {
                let _i1 = Rect.convertindex(indexrect, Rect.new(0, 0, this.x_grid.length, this.y_grid.length), i1);
                if(_i1 === -1) {
                    console.log("this shouldn't happen");
                };
                if(this.areas[_i1] && !replaced.includes(this.areas[_i1])) {
                    replaced.push(this.areas[_i1]);
                };
                this.areas[_i1] = name;
                this.cache.raster[name].push(true);
            }
            for(i1 = 0; i1 < replaced.length; i1++) {
                let _name = replaced[i1];
                this.cache.indexrect[_name] = this.room_indexrect(_name);
                if(!this.cache.indexrect[_name]) {
                // the new room entirely covered and replaced this room.
                    reverse();
                    return false;
                };
                this.cache.raster[_name] = this.room_indexrect(_name, this.cache.indexrect[_name]);
                let temp = this.cache.raster[_name].indexOf(true);
                if(temp === -1) {
                    console.log("this shouldn't happen");
                    reverse();
                    return false;
                }
                else {
                    let raster = this.cache.raster[_name];
                    let w = this.cache.indexrect[_name].w;
                    if(!compareobject(raster, Raster.bucket(raster, w, temp%w, Math.floor(temp/w)))) {
                    // the new room bisected this room. or trisected... or
                    // something.
                        reverse();
                        return false;
                    };
                };
                this.cache.sides[_name] = this.room_sides(_name, this.cache.indexrect[_name], this.cache.raster[_name]);
                // the new room modified the shape of this room, so reevaluate
                // the cache stuff.

            }
            // - it has to reevaluate the doors for the rooms it
            //   modifies.
            // - for every room it replaced space of...
            //   - for every door that was on the room...
            //     - check if it's inside the new room or on its borders, fully
            //       or partially. if so, the new room is forbidden.
            //       - make sure to account for doors on the wall that's being
            //         extruded or intruded. it's fine if those get shortened.
            //     - if not, make sure the name doesn't have to change.
            //       - if the sides object, after reevaluating, no longer has a
            //         side by that name or the side of that name is different,
            //         (shorter versions are fine.) find the new name.
            //       =
            //       - remember to check the unmodified version.
            //       - remember to check adjacent rooms. every door borders two
            //         rooms, (or one room and void) but it can only be assigned
            //         to one room.
            this.cache.sides[name] = this.room_sides(name, this.cache.indexrect[name], this.cache.raster[name]);
            // this is a weird place to put it, but there's no sense running
            // that early when it might abort anyway.
            return true;
        }
    }
}
