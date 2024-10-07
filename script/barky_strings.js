function getmonthnum(mmmYY, shush) {
// input a month in mmmYY format, and this will return which month
// it would be if jan00 was 1.
// - shush: boolean value that prevents the logs, so that this can
//   be used to check if something's a valid month mark.
    if(datechecker(mmmYY) !== "month") {
        if(!shush) {
            console.log("invalid getmonthnum input.");
        };
        return "invalid input";
    };
    let monthnum = Number(mmmYY.slice(3, 5)) * 12;
    if(mmmYY.slice(0, 3)==="jan") {
        monthnum += 1;
    }
    else if(mmmYY.slice(0, 3)==="feb") {
        monthnum += 2;
    }
    else if(mmmYY.slice(0, 3)==="mar") {
        monthnum += 3;
    }
    else if(mmmYY.slice(0, 3)==="apr") {
        monthnum += 4;
    }
    else if(mmmYY.slice(0, 3)==="may") {
        monthnum += 5;
    }
    else if(mmmYY.slice(0, 3)==="jun") {
        monthnum += 6;
    }
    else if(mmmYY.slice(0, 3)==="jul") {
        monthnum += 7;
    }
    else if(mmmYY.slice(0, 3)==="aug") {
        monthnum += 8;
    }
    else if(mmmYY.slice(0, 3)==="sep") {
        monthnum += 9;
    }
    else if(mmmYY.slice(0, 3)==="oct") {
        monthnum += 10;
    }
    else if(mmmYY.slice(0, 3)==="nov") {
        monthnum += 11;
    }
    else if(mmmYY.slice(0, 3)==="dec") {
        monthnum += 12;
    }
    else {
        if(!shush) {
            console.log("getmonthnum tried to convert an invalid month");
        };
        return "invalid input";
    };
    return monthnum;
}
function getmonthmark(monthnum) {
// input a month in mmmYY format, and this will return which month
// it would be if jan00 was 1.
    if(isNaN(Number(monthnum))) {
        console.log("getmonthmark tried to convert an invalid number");
        return "invalid input";
    };
    let year = Math.floor(monthnum/12);
    let month = monthnum%12;
    if(!Number.isInteger(month) || month < 0 || month >= 12) {
        console.log("something went wrong when converting numbers to months.");
        return "unknown error";
    }
    else if(month === 0) {
        year -= 1;
        // subtract one year because it's december, which gets
        // turned into 0 instead of 12. yadda yadda math crap
    };
    month = ["dec", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov"][month];
    year = (year%100).toString();
    year = "0".repeat(2 - year.length) + year;
    return month + year;
}
function datechecker(string) {//, allowperiod) {
// note that this does not tolerate spaces. only a 7-character
// string in DDmmmYY format will be valid, or a 5-character in
// mmmYY. it will return "month" if it's a month mark, "day" if it's
// a day mark, and false if it's neither.
    //if(allowperiod && string.endsWith(".")) {
    //	string = string.slice(0, -1);
    //};
    if(
        typeof string !== "string"
        ||
        !["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].includes(string.slice(-5, -2))
        ||
        string.charCodeAt(string.length - 1) < 48 || string.charCodeAt(string.length - 1) >= 58
        ||
        string.charCodeAt(string.length - 2) < 48 || string.charCodeAt(string.length - 2) >= 58
    ) {
    // if the three characters two away from the end do not make a
    // month, or the last two characters are not digits, it's
    // invalid
        return null;
    }
    else if(string.length === 5) {
        return "month";
    }
    else if(string.length === 7 && Number(string.slice(0, 2)) >= 1 && Number(string.slice(0, 2)) <= 31) {
        return "day";
    }
    else {
        return null;
    };
}
function datetonum(date) {
// converts it to a number array of day and month.
    let temp = datechecker(date);
    if(!temp) {
        return null;
    }
    else if(temp === "month") {
        return [0, getmonthnum(date, true)];
    }
    else if(temp === "day") {
        return [Number(date.slice(0, 2)), getmonthnum(date.slice(2), true)];
    };
};
function datecompare(date1, date2, strict) {
// returns the Math.sign of whether date2 is after, (1) before, (-1)
// or during (0) date1.
// - NOTE it also returns null if date1 is a day and date2 is the
//   same month.
// - strict: boolean that makes it so a month comes before all days
//   within that month.
//   - it always returns a sign, and it's only zero if both are the
//     same...
//   - it's used for .sort operations.
    if(typeof date1 === "string") {
        date1 = datetonum(date1);
    };
    if(typeof date2 === "string") {
        date2 = datetonum(date2);
    };
    let sign = Math.sign(date2[1] - date1[1]);
    if(sign === 0) {
    // same month
        if(strict) {
            return Math.sign(date2[0] - date1[0]);
        }
        else if(date1[0] === date2[0] || date1[0] === 0) {
        // equal day and day, month and day
            return 0;
        }
        else if(date2[0] === 0) {
        // day and month
            return null;
        }
        else {
        // unequal day and day
            return Math.sign(date2[0] - date1[0]);
        };
    }
    else {
        return sign;
    }
}
let datewithinrange = (date, from, to) => (
    (from === null || [0, 1].includes(datecompare(from, date)))
    // if it's within or after from
    &&
    (to === null || [0, -1].includes(datecompare(to, date)))
    // and within or after to
);
function sortdates(array) {
// sorts an array of dates. months come before days in the same month.
    array.sort((a, b) => datecompare(b, a, true));
};
function sortdatedobject(object) {
// returns an object that's been reconstructed so it'll iterate through
// the dates in order.
// - it also combines all non-dates into one .unknown property.
//   - NOTE be careful of arrays and shared property names. all it does
//     is apply every property of non-date object properties to unknown,
//     or create a property of the same name if the non-date isn't an
//     object.
// - this uses structuredClone, it won't preserve classes
    let i1 = 0;
    let i2 = 0;
    let newobj = {};
    let keys = Object.keys(object);
    for(i1 = 0; i1 < keys.length; i1++) {
        if(!datechecker(keys[i1])) {
        // if it isn't a date, create the .unknown and move it into
        // there.
            newobj.unknown ??= {};
            if(typeof object[keys[i1]] === "object") {
            // if it's an object, combine them
                for(i2 in object[keys[i1]]) {
                    if(object[keys[i1]].hasOwnProperty(i2)) {
                        newobj.unknown[i2] = structuredClone(object[keys[i1]][i2]);
                    }
                }
            }
            else {
                newobj.unknown[keys[i1]] = structuredClone(object[keys[i1]]);
            }
            delete object[keys[i1]];
            keys.splice(i1, 1);
            i1--;
        }
    }
    // delete all non-dates
    sortdates(keys);
    for(i1 = 0; i1 < keys.length; i1++) {
    // now that it's sorted, it should iterate in the right order.
        newobj[keys[i1]] = structuredClone(object[keys[i1]]);
    };
    return newobj;
};
function datestring(year, month, day) {
// numbers follow Date conventions. months are 0-11, but days start with 1
// instead of 0
    year = posmod(year, 100);
    return (
        (typeof day === "number" ? "0".repeat(day < 10) + day : "")
        +
        "janfebmaraprmayjunjulaugsepoctnovdec".slice(3*month, 3*(month + 1))
        +
        "0".repeat(year < 10) + year
    );
};
function datearray(string) {
    let temp = datechecker(string);
    if(temp === "day") {
        temp = datearray(string.slice(2));
        temp[temp.length] = Number(string.slice(0, 2));
        return temp;
    }
    else if(temp === "month") {
        let month = string.slice(0, 3);
        let year = string.slice(3);
        month = "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(month);
        if(month%3) {
            console.log("this shouldn't happen");
            return null;
        };
        year = (year.length === 2 ? 2000 : 0) + Number(year);
        month /= 3;
        return [year, month];
    }
    else {
        return null;
    }
};
function breakbydate(text) {
// input text that's divided up by dates, and it'll make an object of the text
// associated with each date.
// - the only divisions this will tolerate are lines with nothing but a DDmmmYY
//   or mmmYY date, no spaces before or after.
    let array = text.split("\n");
    let obj = {};
    let date = "unknown";
    let place = 0;
    while(place < array.length) {
        let end = array.length;
        for(let i1 = place; i1 < array.length && end === array.length; i1++) {
            if(datechecker(array[i1])) {
                end = i1;
            }
        }
        obj[date] ??= "";
        obj[date] += (obj[date] ? "\n" : "") + array.slice(place, end).join("\n");
        date = end < array.length ? array[end] : date;
        place = end + 1;
    }
    return obj;
}
/*
function breakbydate(text) {
// - NOTE date properties are NOT organized how they are in ac_data.
//   they're just strings.
    let array = breakbyline(text, (line) => datechecker(line), false, true);
    // the text, broken up into an array. every line with nothing
    // but a date is a new division. (it does not tolerate spaces
    // before)
    let object = {};
    // what's returned at the end
    let currentdate = "unknown";
    for(let i1 = 0; i1 < array.length; i1++) {
        if(datechecker(array[i1].slice(0, array[i1].indexOf("\n")))) {
            currentdate = array[i1].slice(0, array[i1].indexOf("\n"));
            array[i1] = array[i1].slice(array[i1].indexOf("\n"));
            // set the date as the first line, slice it off
        }
        else {
            currentdate = "unknown";
        };
        if(object.hasOwnProperty(currentdate)) {
            if(currentdate !== "unknown") {
                //console.log("a date was repeated. weird, but not impossible. it isn't interfering with the use of this tool but you should probably know that. it was " + currentdate + " and the contents are...");
                //console.log(array[i1]);
            };
            object[currentdate] += "\n\n" + array[i1].trim();
        }
        else {
            object[currentdate] = array[i1].trim();
        };
    }
    return object;
}
//*/
//
function word_wrap(string, width, linebreak) {
    let i1 = 0;
    let i2 = 0;
    width = Math.max(0, width);
    if(!Number.isInteger(width)) {
        console.log("must specify line width.");
        return;
    };
    // zero width is allowed. it would make every word print on a new line.
    linebreak ??= String.fromCharCode(10);
    let input = string.trim().split(linebreak);
    let output = [];
    let line = "";
    // one line of wrapped text
    function addline() {
        output[output.length] = line;
        line = "";
    }
    for(i1 = 0; i1 < input.length; i1++) {
    // for every block of text separated by line breaks
        let block = input[i1].split(" ");
        for(i2 = 0; i2 < block.length; i2++) {
        // for every word
            let word = " ".repeat(!!line) + block[i2];
            if(word.length > width && line.length === 0) {
            // word is longer than is possible to fit on the line
                line = word;
                addline();
            }
            else if((width - line.length) >= word.length) {
            // can fit on the line
                line += word;
            }
            else {
            // can't fit on the line, so start a new one
                addline();
                line = block[i2];
            }
        }
        if(line) {
            addline();
        }
    }
    return output.join(linebreak);
};
function formatlinebreaks(input) {
// sometimes, for really dumb reasons, one or multiple of four
// goddamn linebreak characters can be used for a linebreak. so.
// this fixes that.
// - specifically, it finds an uninterrupted line of linebreak
//   characters and replaces them with String.fromCharCode(10)s. the
//   number of String.fromCharCode(10)s it uses is however many
//   times the most common linebreak character appeared in that line
//   of linebreak-esque characters.
    let i1 = 0;
    let newline = null;
    for (i1 = 0; i1 <= input.length; i1++) {
        if(![10, 11, 12, 13].includes(input.charCodeAt(i1)) || i1 === input.length) {
            if(newline !== null) {
            // if it's the end of a sequence of linebreaks
                input = input.slice(0, newline.index) + String.fromCharCode(10).repeat(Math.max(...newline.count)) + input.slice(newline.index + newline.string.length);
                newline = null;
            }
        }
        else if(newline === null) {
        // if it's the beginning of a sequence of linebreaks
            newline = {
                index: i1,
                string: input.charAt(i1),
                count: [0, 0, 0, 0],
            };
            newline.count[input.charCodeAt(i1) - 10] += 1;
        }
        else {
        // if it's continuing a sequence of linebreaks
            newline.string += input.charAt(i1);
            newline.count[input.charCodeAt(i1) - 10] += 1;
        };
    }
    return input;
};
function breakbyline(input, code, code2, retainbeginning) {
//breakbyline(input, (line) => expression, (line) => expression, retainbeginning)
// breaks up the text into an array, the divides being lines that return
// a true result when run through the arrow function provided.
// - code2: if this exists and a line fulfills this condition, the rest
//   of the current block of text will be omitted.
//   - it is NOT the same as a division. the content between the first
//     true line and the next division is omitted entirely. this
//     includes content that *doesn't* fulfill this, as long as it's
//     after a line that does.
// - retainbeginning: unless this argument is true or the beginning
//   fulfills the divider condition, the first item of the array will be
//   spliced out.
    let i1 = 0;
    let i2 = 0;
    let array = [];
    let omitting = !retainbeginning;
    // boolean that stores whether it's between a line that fulfills
    // code2, and the next division line.
    input = formatlinebreaks(input).split(String.fromCharCode(10));
    for(i1 = 0; i1 < input.length; i1++) {
        let newsector = i1 === 0;
        if(code(input[i1])) {
            omitting = false;
            newsector = true;
        };
        if(!omitting) {
            if(code2 && code2(input[i1])) {
            // if code2 exists and this fulfills it, omit the content
            // from this line to the next division.
                omitting = true;
            };
            if(newsector) {
                array[array.length] = input[i1];
            }
            else {
                array[array.length - 1] += "\n" + input[i1];
            };
        };
    }
    return array;
};
class Bullets {
// a class for converting the syntax i use in my personal notes into usable
// data.
// - structure:
//   - numbered indexes (represent bullets, in the order they appear
//     in text)
//     - text
//     - indent: 0 is unbulleted, 1 is a bullet, 2 is a bullet's
//       bullet, etc
//     - character: if it used something from allowthese instead of
//       a -, this property will show what
//     - dividers: an array of things printed before the bullet, 1 indent lower.
//       - like dates, to show when each bullet was written.
//       - see Bullets.validdivider for which dividers are allowed.
//       - = means it's a different kind of bullet compared to its siblings.
//         like if you were writing a list, some bullets would be list items,
//         but some would be elaborating on what the list is.
//         - NOTE: this affects getdate. it's assumed that dates in the same
//           generation don't apply if there's a = between them and the bullet
//           you're trying to find the date of.
//       - i use - to denote time passing. like if i write something, but then
//         go back and elaborate on the first bullet, but what i'm writing sort
//         of references the later bullets. it means "this makes more sense
//         after reading the rest", i guess.
//     - newpara: means there's a blank line between it and the previous bullet.
//       - it can be true, false, or a date. if it's a date, that means the
//         input had a blank line, a line with nothing but a date, then another
//         blank line
//       - after a newpara date, every paragraph starts with that date until
//         another newpara date.
//         - meaning, if a paragraph is a few zero indent bullets and there's a
//           date divider in there somewhere, that date divider will be negated
//           at the end of that paragraph.
//         - it's more intuitive than it sounds. probably.
//       - all functions for finding siblings, parents, etc do not cross newpara
//         lines. bullets in different paragraphs are considered unrelated.
//         - which also means deleting bullets with .remove won't shift the
//           dividers across to the next paragraph, since that wouldn't make
//           sense.
//   - retainbreaks, allowthese, date: arguments when it was constructed
// TODO shiiiiit this also has to keep in mind dates and shit,
// - bullets need to have a property for "this comes after a - divider,
//   and here is how many", same for =
// - and it has to detect month/day marks at the end and apply them
//   to every child or sibling after
// - this will be locked behind myformatting, of course
    constructor(input, myformatting, retainbreaks, allowthese, date) {
    // there was already something like this called bulletconverter
    // but it is a fucking mess
    // - even though i didn't even write it that long ago?
    // - myformatting: i go from 0 spaces at 0 indent to 5 at 1.
    // - retainbreaks: it will not replace line breaks within
    //   bullets with spaces
    // - allowthese: a string for allowing characters besides "-" to
    //   be used as bullets, like "*". these will be stored in the
    //   character property of the bullet.
    // - date: this is added to the first bullet's newpara.
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        if(input instanceof Bullets) {
        // create an empty Bullets with the same properties.
            for(i1 in input) {
                if(input.hasOwnProperty(i1) && !Number.isInteger(Number(i1))) {
                    this[i1] = structuredClone(input[i1]);
                }
            }
            return this;
        }
        this.retainbreaks = !!this.retainbreaks;
        this.allowthese = "";
        if(typeof allowthese === "string" && allowthese) {
        // get rid of duplicates and whitespace
            for(i1 = 0; i1 < allowthese.length; i1++) {
                if(!this.allowthese.includes(allowthese[i1]) && allowthese[i1].trim()) {
                    this.allowthese += allowthese[i1];
                }
            }
        };
        if(!this.allowthese) {
            this.allowthese = "-";
        }
        allowthese = this.allowthese;
        const LB = String.fromCharCode(10);
        // short for "line break"
        let isbullet = (line) => ( allowthese.includes(line.trimStart().charAt(0)) && line.trimStart().charAt(1) === " " );
        // doesn't allow zero indent bullets.
        function oneparagraph(input) {
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            input = breakbyline(
                input.trim(),
                (line) => !line.startsWith(" ") || isbullet(line),
                false,
                // cutoff function
                true
                // retain beginning
            );
            let indents = [];
            let dividers = [];
            // matching arrays that store the indent and dividers respectively.
            for(i1 = 0; i1 < input.length; i1++) {
                // find the indent level of each bullet
                indents[i1] = (
                    isbullet(input[i1])
                    ?
                    Bullets.spacenum(input[i1].length - input[i1].trimStart().length, true, true, myformatting)
                    :
                    0
                );
                dividers[i1] = [];
            };
            for(i1 = 0; i1 < input.length - 1; i1++) {
                // use the next bullet's indent level to check if this bullet
                // ends with dividers for it (skip the last one because there's
                // no next bullet to look at.)
                input[i1] = input[i1].split(LB);
                for(i2 = input[i1].length - 1; i2 >= 0; i2--) {
                    // search backwards
                    if(Bullets.validdivider(input[i1][i2], indents[i1 + 1], myformatting)) {
                        let temp = input[i1].splice(i2, 1)[0].trim();
                        // splice returns what it deletes. (but it's in
                        // array form even if it's a single item, so add
                        // [0], and trim it so it's easier to process)
                        dividers[i1 + 1].splice(0, 0, temp);
                        // add it to the beginning of the next bullet's
                        // dividers
                    }
                    else {
                        // exit once you find an invalid divider
                        i2 = -1;
                    }
                }
                input[i1] = input[i1].join(LB);
                // reverse the split
                if(!input[i1].trim()) {
                    input.splice(i1, 1);
                    indents.splice(i1, 1);
                    dividers.splice(i1, 1);
                    // nothing but dividers, so delete it.
                    // - or it was empty to begin with. sometimes those
                    //   happen, at the beginning and end.
                    i1--;
                    // make sure it doesn't skip the bullet that's now at i1
                };
            };
            for(i1 = 0; i1 < input.length; i1++) {
                let text = input[i1].trim().split(LB);
                for(i2 = 0; i2 < text.length; i2++) {
                    text[i2] = text[i2].trim();
                }
                text = text.join(retainbreaks ? LB : " ");
                // get rid of indent
                let indent = indents[i1];
                input[i1] = structuredClone(Bullets.template);
                input[i1].text = text;
                input[i1].indent = indent;
                input[i1].dividers = structuredClone(dividers[i1]);
                if(indent) {
                    input[i1].character = input[i1].text.charAt(0);
                    input[i1].text = input[i1].text.slice(2);
                }
                else if(allowthese.includes(input[i1].text.charAt(0))) {
                    input[i1].character = input[i1].text.charAt(0);
                    input[i1].text = input[i1].text.slice(1);
                }
                else {
                    input[i1].character = allowthese[0];
                };
            }
            return input;
        }
        //input = oneparagraph(input);
        input = input.split("\n");
        for(i1 = 0; i1 < input.length; i1++) {
            if(!input[i1].trim()) {
            // if a line has nothing but whitespace, make it totally empty
                input[i1] = "";
                let splice = i1 + 1;
                for(; splice < input.length && !input[splice].trim(); splice++) {
                }
                input = input.slice(0, i1 + 1).concat( input.slice(splice) );
                //input.splice(i1 + 1, (splice - 1) - i1);
                // and while you're at it, get rid of consecutive blank lines.
                // - splice is the number of the next non-blank line, so splice
                //   everything between i1 and that.
            }
        }
        input = input.join("\n").split("\n\n");
        date = datechecker(date) ? date : null;
        for(i1 = 0; i1 < input.length; i1++) {
        // each input is a paragraph created with oneparagraph.
            if(datechecker(input[i1].trim())) {
            // dates surrounded by blank lines are used as the new .date for all
            // following Bullets
                date = input[i1].trim();
                input.splice(i1, 1);
                i1--;
            }
            else {
                input[i1] = oneparagraph(input[i1]);
                if(input[i1].hasOwnProperty("0")) {
                // each one is a new paragraph
                    input[i1][0].newpara = date ?? true;
                    // include the date if there was one
                    date = null;
                    // but only do that once.
                }
                else {
                    input.splice(i1, 1);
                    i1--;
                }
            }
        }
        let temp = 0;
        for(i1 = 0; i1 < input.length; i1++) {
            for(i2 = 0; i2 < input[i1].length; i2++) {
                this[temp + i2] = structuredClone(input[i1][i2]);
            }
            temp += input[i1].length;
            // total length of the input indexes covered so far
        }
        // transfer the contents of input into this
    }
    static template = {
        text: "",
        indent: 0,
        character: "-",
        dividers: [],
        newpara: false,
    }
    // template for a single bullet. (useful when creating Bullets through
    // custom code instead of the constructor. like .intent)
    get length() {
        return objarraylength(this);
    }
    static spacenum(indent, tobullet, inverse, myformatting) {
    // input an indent number and it'll tell you how many spaces it has
    // from the beginning of a line to the text. (the text, not the
    // bullet character.)
    // - tobullet: makes it assume you want the number of spaces to the
    //   bullet character, instead. (it can be a pain in the ass because
    //   0 indent doesn't have a bullet.)
    // - inverse: reverses it so you're inputting the number of spaces
    //   and getting an indent number.
    // - 0, 5, 7, 9 (or 0, 3, 5, 7 if myformatting is off)
        let threshold = (myformatting ? 3 : 1) + (tobullet ? 0 : 2);
        return (
            inverse
            ?
            (
                indent >= threshold
                ?
                1 + Math.floor((indent - threshold)/2)
                :
                0
            )
            :
            (
                indent > 0
                ?
                threshold + 2*(indent - 1)
                :
                0
            )
        );
    }
    static validdivider(line, targetindent, myformatting) {
        //console.log(!Number.isInteger(targetindent));
        //console.log((line.length - line.trimStart().length) === Bullets.spacenum(targetindent, true, false, myformatting));
        //console.log(["-", "="].includes(line.trim()));
        //console.log(datechecker(line.trim()));
        //console.log((myformatting && line.trim().endsWith(".") && datechecker(line.trim().slice(0, -1))));
        return (
            (
                !Number.isInteger(targetindent)
                // no valid indent (which i take to mean "any indent is fine")
                ||
                (line.length - line.trimStart().length) === Bullets.spacenum(targetindent, true, false, myformatting)
                // matches targetindent
            )
            &&
            (
                ["-", "="].includes(line.trim())
                // divider
                ||
                !!datechecker(line.trim())
                // date
                ||
                (myformatting && line.trim().endsWith(".") && !!datechecker(line.trim().slice(0, -1)))
                // date with a period
            )
        );
    }
    static fixdividers(array) {
    // corrects problems with dividers. usually benign problems that still look
    // bad.
    // - for example, if bullet A, B, and C all have different dates... getting
    //   rid of B and shifting its dividers to C will mean that C has two dates
    //   preceding it. which makes no sense, because nothing uses the first
    //   date.
    // - if there's one or more =s, it deletes everything before the last one.
    // - if there's multiple dates, it only keeps the last one.
        let i1 = 0;
        let _array = null;
        for(i1 = array.length - 1; i1 >= 0 && _array === null; i1--) {
            if(array[i1] === "=") {
                _array = array.slice(i1);
            }
        }
        _array ??= structuredClone(array);
        let temp = false;
        for(i1 = _array.length - 1; i1 >= 0; i1--) {
            if(datechecker(_array[i1])) {
            // if there's more than one date, delete all but the last one.
                if(temp) {
                    _array.splice(i1, 1);
                }
                else {
                    temp = true;
                }
            };
            if(!Bullets.validdivider(_array[i1])) {
            // delete invalid dividers
                _array.splice(i1, 1);
            };
        }
        return _array;
    }
    static bulletstart(line, myformatting, allowthese) {
    // if the line is the start of a bullet, it returns the indent. otherwise,
    // it returns -1.
        let _indent = line.length - line.trimStart().length;
        let indent = Bullets.spacenum(_indent, true, true, myformatting);
        return (
            (
                indent
                ?
                (line.length >= _indent + 2 && allowthese.includes(line[_indent]) && line[_indent + 1] === " ")
                :
                !Bullets.validdivider(line, null, myformatting) && line
            )
            ?
            indent
            :
            -1
        );
    }
    string(width, myformatting) {
    // creates a string variable from a Bullets object
    // - width: number of characters per line
    // - myformatting: 1 indent is 5 spaces instead of 3, 2 is 7,
    //   etc
        if(!width) {
            console.log("must specify line width.");
            return;
        };
        let length = this.length;
        let output = "";
        for(let i1 = 0; i1 < length; i1++) {
            output += (output ? "\n" : "") + this.stringat(i1, width, myformatting, "all");
        }
        return output;
    }
    string_html(width, myformatting) {
        let string = entityreplacement( this.string(width, myformatting) ).replaceAll("\n", "<br>");
        while(string.includes("  ")) {
            string = string.replaceAll("  ", " &#160;");
        }
        return string;
    }
    stringat(index, width, myformatting, dividers) {
    // get the string of the bullet specified, or the array of
    // indexes.
    // - the latter can be used with .anc/.desc to get a string of all ancestors
    //   or all descendants.
    // - dividers:
    //   - "all": contents of the .dividers and .newpara
    //   - "date": uses getdate
    //   - falsy: none
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        if(!width && !this.retainbreaks) {
            console.log("must specify line width.");
            return;
        };
        if(Array.isArray(index)) {
            let i1 = 0;
            let output = "";
            for (i1 = 0; i1 < index.length; i1++) {
                output += (output ? "\n" : "") + this.stringat(index[i1], width, myformatting, dividers);
            }
            return output;
            // recursiooooon
        };
        index = Number(index);
        let spaces = " ".repeat(Bullets.spacenum(this[index].indent, false, false, myformatting));
        // spaces to the text
        let _spaces = " ".repeat(Bullets.spacenum(this[index].indent, true, false, myformatting));
        // spaces to the bullet or dividers
        let text = this[index].text;
        if(this[index].indent) {
            text = _spaces + this[index].character + " " + word_wrap(text, width - spaces.length).replaceAll("\n", "\n" + spaces);
        }
        else {
        // zero indent doesn't need word wrap
            if(this[index].character !== "-" && this[index].character !== String.fromCharCode(183)) {
                text = this[index].character + text;
            }
        };
        if(dividers === "all") {
            if(this[index].dividers.length) {
                text = _spaces + structuredClone(this[index].dividers).join("\n" + _spaces) + "\n" + text;
            };
            if(this[index].newpara) {
            // if it's a date, add "\n" + date + "\n". otherwise, just one "\n".
            // skip the first "\n" if it's the first bullet.
                if(datechecker(this[index].newpara)) {
                    text = this[index].newpara + "\n\n" + text;
                };
                if(index) {
                    text = "\n" + text;
                };
            }
        }
        else if(dividers === "date") {
            let date = this.getdate(index);
            if(date) {
                text = _spaces + date + "\n" + text;
            };
        };
        return text;
    }
    lineagestring(index, width, myformatting) {
    // gives an array of the text for the ancestors, main bullet, and
    // descendants, with dividers placed where they make sense.
    // - ancestors and the main bullet get dates if they're a different
    //   date from their parent. descendants keep all their dividers.
        index = Number(index);
        let i1 = 0;
        let i2 = 0;
        let ancestors = this.anc(index);
        let main = "";
        for(i1 = 0; i1 <= ancestors.length; i1++) {
            const _index = i1 === ancestors.length ? index : ancestors[i1];
            let date = this.getdividers(_index, true);
            date = date.slice( date.indexOf("=") + 1 );
            // if there's an = divider, only search what's after that
            for(i2 = date.length - 1; i2 >= 0 && Array.isArray(date); i2--) {
                if(datechecker(date[i2])) {
                    date = " ".repeat( Bullets.spacenum(this[_index].indent, true, false, myformatting) ) + date[i2] + String.fromCharCode(10);
                }
                else if(i2 === 0) {
                    date = "";
                };
            }
            // date should now be text that can be put before the
            // ancestor bullet's stringat. empty if it's the same as its
            // parent, and indented if it isn't.
            // - it's like getdate, but it stops at one generation.
            if(i1 === ancestors.length) {
                main = date + this.stringat(index, width, myformatting);
            }
            else {
                ancestors[i1] = date + this.stringat(_index, width, myformatting);
            }
        }
        ancestors = ancestors.join(String.fromCharCode(10));
        let descendants = this.desc(index);
        for(i1 = 0; i1 < descendants.length; i1++) {
            descendants[i1] = this.stringat(descendants[i1], width, myformatting, "all");
        }
        descendants = descendants.join(String.fromCharCode(10));
        return [ancestors, main, descendants];
    }
    parent(index) {
    // index of this bullet's parent
        let indent = this[index].indent;
        if(indent === 0) {
            return null;
        }
        index--;
        for(; index >= 0; index--) {
            if(this[index].indent === indent - 1) {
                return index;
            }
            else if(this[index].newpara) {
            // crossed into previous paragraph
                return null;
            }
        }
        return null;
    }
    anc(index) {
    // an array of this bullet's ancestors, from furthest to closest
    // - NOTE: do NOT assume that [0] will be a zero indent bullet and so on. if
    //   the bullets is structured in an unusual way, it won't work like that.
    //   - for example, if the paragraph has no zero-indents
    //   - or if a bullet is more than 1 more than the previous bullet's indent
        let array = [this.parent(index)];
        for(; array[0] !== null;) {
            array.splice(0, 0, this.parent(array[0]));
        }
        array.splice(0, 1);
        return array;
    }
    desc_length(index) {
    // number of descendants
        const start = index + 1;
        let indent = this[index].indent;
        index++;
        let length = this.length;
        for(; index < length; index++) {
            if(this[index].indent <= indent || this[index].newpara) {
            // reached an aunt/uncle, or a new paragraph
                return index - start;
            };
        }
        return length - start;
    }
    desc(index) {
    // an array of all of this bullet's descendants
        let temp = this.desc_length(index);
        let array = [];
        for(let i1 = 0; i1 < temp; i1++) {
            array[array.length] = index + 1 + i1;
        }
        return array;
    }
    prevsibling(index) {
        let indent = this[index].indent;
        index--;
        for(; index >= 0; index--) {
            if(this[index].indent < indent) {
                return null;
            }
            else if(this[index].indent === indent) {
                return index;
            };
            if(this[index].newpara) {
            // iterating any further will cross into a previous paragraph.
                return null;
            };
        }
        return null;
    }
    nextsibling(index) {
        let indent = this[index].indent;
        index++;
        let length = this.length;
        for(; index < length; index++) {
            if(this[index].indent < indent || this[index].newpara) {
            // reached an aunt/uncle or crossed to the next paragraph.
                return null;
            }
            else if(this[index].indent === indent) {
                return index;
            };
        }
        return null;
    }
    slice(index1, index2) {
    // returns a new Bullets with only the slice you specified. (slice
    // indexes work like the string .slice.)
    // - NOTE this doesn't do anything with dates, so if you sliced
    //   stuff that used to be the children of a bullet with a date,
    //   without the context of the parent, it won't know what date it
    //   used to be associated with. use branch instead if you want it
    //   to be smarter.
        index1 = Number(index1);
        index2 = Number(index2);
        let slice = new Bullets(this);
        let length = this.length;
        index1 = !isNaN(index1) ? index1 : 0;
        index2 = !isNaN(index2) ? index2 : length;
        if(index1 < 0) {
            index1 += length;
        };
        if(index2 < 0) {
            index2 += length;
        };
        let place = 0;
        for (let i1 = index1; i1 < index2; i1++) {
            slice[i1 - index1] = structuredClone(this[i1]);
        };
        return slice;
    }
    branch(index, lower) {
    // returns a new Bullets with nothing but the indicated bullet and
    // its descendants.
    // - it also does some complicated shit so that dates are what
    //   they're supposed to be. (one of the limitations of slice is
    //   that if you slice content with no dates in it, the dates will
    //   be unknown even if getdate could've figured it out from the
    //   ancestors.)
    // - lower: if true, it'll lower it so that the main bullet's indent
    //   is zero.
        index = Number(index);
        let temp = this.desc_length(index);
        let newbul = this.slice(index, index + 1 + temp);
        newbul[0].dividers = [this.getdate(index)];
        // replace all dividers with one date.
        if(lower) {
            let length = newbul.length;
            for(let i1 = 0; i1 < length; i1++) {
                newbul[i1].indent -= this[index].indent;
            };
        }
        return newbul;
    }
    split(newpara) {
    // finds the lowest .indent number within and splits a new Bullets
    // object every time it finds one of that indent.
    // - you can break it up so that every 0 indent (that is, a
    //   paragraph) is a new Bullets.
    // - if newpara is on, it'll split it up by newpara instead.
        let i1 = 0;
        let length = this.length;
        let slice = 0;
        let split = [];
        if(newpara) {
            for(i1 = 1; i1 < length; i1++) {
                if(this[i1].newpara) {
                    split[split.length] = this.slice(slice, i1);
                    slice = i1;
                }
            }
            split[split.length] = this.slice(slice);
            return split;
        }
        let lowestindent = Infinity;
        for (i1 in this) {
            if (this.hasOwnProperty(i1) && !isNaN(Number(i1))) {
                lowestindent = Math.min(lowestindent, this[i1].indent);
            };
        }
        for (i1 = 1; i1 < length; i1++) {
        // run through every bullet after the first
            if(this[i1].indent === lowestindent) {
                split[split.length] = this.slice(slice, i1);
                slice = i1;
            }
        }
        split[split.length] = this.slice(slice);
        return split;
    }
    concat(bullets2) {
    // returns two Bullets objects combined.
    // - NOTE: the non-bullet properties of the second object will be totally
    //   ignored. (except for the .allowthese, which is combined with the
    //   current .allowthese.)
    // - NOTE this does not take into account differences in dates and
    //   crap like that. this is pretty much just a substitute for
    //   Array.concat.
        let i1 = 0;
        let _return = new Bullets(this);
        let length1 = this.length;
        for (i1 = 0; i1 < length1; i1++) {
            _return[i1] = structuredClone(this[i1]);
        }
        let length2 = bullets2.length;
        for (i1 = 0; i1 < length2; i1++) {
            _return[length1 + i1] = structuredClone(bullets2[i1]);
        }
        if(bullets2.hasOwnProperty("allowthese")) {
            _return.allowthese ??= "";
            let temp = bullets2.allowthese;
            for (i1 = 0; i1 < _return.allowthese.length; i1++) {
                temp = temp.replaceAll(_return.allowthese[i1], "");
            }
            // avoid repeats
            _return.allowthese += temp;
        };
        return _return;
    }
    changeindent(change, index1, index2) {
    // add/subtract indent for all or part of the Bullets.
    // - NOTE this modifies it directly, it doesn't return a new
    //   Bullets.
    // - it won't go below 0.
        index1 = Number(index1);
        index2 = Number(index2);
        let length = this.length;
        index1 = !isNaN(index1) ? index1 : 0;
        index2 = !isNaN(index2) ? index2 : length;
        if(index1 < 0) {
            index1 += length;
        };
        if(index2 < 0) {
            index2 += length;
        };
        for(let i1 = index1; i1 < index2; i1++) {
            this[i1].indent = Math.max(0, this[i1].indent + change);
        };
    }
    getdividers(index, includedates) {
    // returns an array of all the dividers from the beginning of this
    // bullet to the first child of its parent.
    // - includedates: if falsy, it'll omit dates
        index = Number(index);
        let array = [];
        for(; Number.isInteger(index) && index >= 0;) {
        // search through all siblings
            array = this[index].dividers.concat(array);
            index = this.prevsibling(index);
        };
        if(!includedates) {
            for(i1 = 0; i1 < array.length; i1++) {
                if(datechecker(array[i1])) {
                    array.splice(i1, 1);
                    i1--;
                }
            }
        }
        return array;
    }
    getdate(index) {
    // returns null if it didn't find any.
        index = Number(index);
        let anc = this.anc(index);
        anc[anc.length] = index;
        for(let i1 = anc.length - 1; i1 >= 0; i1--) {
        // search backwards through dates/dividers for the closest date
            let dividers = this.getdividers(anc[i1], true);
            dividers = dividers.slice( dividers.lastIndexOf("=") + 1 );
            // if there's an = divider, only search what's after that
            for(let i2 = dividers.length - 1; i2 >= 0; i2--) {
                let temp = dividers[i2];
                if(temp.endsWith(".")) {
                    temp = temp.slice(0, -1);
                };
                if(datechecker(temp)) {
                    return temp;
                };
            }
        }
        for(let i1 = index; i1 >= 0; i1--) {
            if(datechecker(this[i1].newpara)) {
                return this[i1].newpara;
            }
        }
        // if there's no date dividers, check for date newpara.
        return null;
    }
    html(width, tabwidth, indent_space, edits) {
    // - tabwidth: this is only important for word wrapping it for your ide.
    // - indent_space: the number of spaces to add before dividers. preferably
    //   something that puts them about where the bullet symbols are.
    // - edits: an array of objects representing edits to apply after entity
    //   replacement.
    //   - it replaces html characters like <, >, etc with codes that display
    //     the same thing without being interpreted as html syntax. this keeps
    //     it from screwing everything up because you used a < or > symbol, but
    //     it also means you can't do html stuff even if you were trying to.
    //   - the structure is:
    //     - indexes: bullets indexes to apply these changes to. if omitted,
    //       it'll apply it to all of them.
    //     - start, end: string added to the beginning or end
    //     - func: (string, index, bullets) function used to create an edited
    //       version.
    //     - style: added to the style property of the entire <li>/<p>
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        tabwidth ??= 4;
        indent_space ??= 0;
        if(!Array.isArray(edits)) {
            edits = typeof edits === "object" ? [edits] : [];
        }
        let html = [];
        let length = this.length;
        let last_indent = 0;
        function addline(text, _indent) {
            html[html.length] = "\t".repeat(_indent) + text;
        }
        for(i1 = 0; i1 <= length; i1++) {
            let indent = i1 === length ? 0 : this[i1].indent;
            for(i2 = last_indent; i2 < indent; i2++) {
                addline(`<ul>`, i2);
            }
            for(i2 = last_indent; i2 > indent; i2--) {
                addline(`</ul>`, i2 - 1);
            }
            if(i1 === length) {
                addline(`</p>`, indent);
                // open/close ul and p tags
            }
            else {
                if(this[i1].newpara) {
                    if(i1) {
                        addline("<hr>", 0);
                    };
                    if(datechecker(this[i1].newpara)) {
                        addline(this[i1].newpara, 0);
                        addline("<hr>", 0);
                    };
                };
                if(this[i1].dividers.length) {
                    for(i2 = 0; i2 < this[i1].dividers.length; i2++) {
                        let text = this[i1].dividers[i2];
                        text = (
                            text === "-" ? `<li style="list-style-type: disc"></li>` :
                            text === "=" ? `<li style="list-style-type: circle"></li>` :
                            text
                        );
                        // make - look like an empty bullet, make = look like an
                        // empty bullet that's hollow
                        if(indent) {
                            text = `&#160;`.repeat(indent_space) + text;
                            if(i2 === 0) {
                                text = `</ul>` + text;
                            };
                            if(i2 === this[i1].dividers.length - 1) {
                                text += `<ul>`;
                            };
                        };
                        addline(text, indent);
                    }
                };
                // write dividers
                let style = (
                    indent
                    ?
                    "list-style-type: " + ((this[i1].character === "-" || this[index].character === String.fromCharCode(183)) ? "disc" : "circle")
                    :
                    ""
                );
                for(i2 = 0; i2 < edits.length; i2++) {
                    if(
                        (!edits[i2].hasOwnProperty("indexes") || edits[i2].indexes.includes(i1))
                        &&
                        edits[i2].hasOwnProperty("style")
                    ) {
                        if(style && !style.endsWith(";")) {
                            style += ";";
                        };
                        style += edits[i2].style;
                    }
                }
                // create the style text
                addline(`<` + (indent ? `li` : `p`) + (style ? ` style=` + JSON.stringify(style) : ``) + `>`, indent);
                // open <li> element, or add line breaks
                let text = entityreplacement(this[i1].text).replaceAll("\n", "<br>");
                for(i2 = 0; i2 < edits.length; i2++) {
                    // apply post-entity-replacement edits
                    if(!edits[i2].hasOwnProperty("indexes") || edits[i2].indexes.includes(i1)) {
                        for(i3 in edits[i2]) {
                            if(edits[i2].hasOwnProperty(i3)) {
                                if(i3 === "start") {
                                    text = edits[i2][i3] + text;
                                }
                                else if(i3 === "end") {
                                    text += edits[i2][i3];
                                }
                                else if(i3 === "func") {
                                    text = edits[i2][i3](text, i1, this);
                                };
                            }
                        }
                    }
                }
                text = word_wrap(text, width - tabwidth*indent);
                if(Number.isInteger(width) && width >= 0) {
                    addline(text.replaceAll(
                        String.fromCharCode(10),
                        String.fromCharCode(10) + String.fromCharCode(9).repeat(indent)
                    ), indent);
                    // word wrap, add indent
                }
                else {
                    addline(text, indent);
                };
                if(indent) {
                    addline(`</li>`, indent);
                }
                else if(i1 < length - 1 && this[i1 + 1].indent === 0) {
                    addline(`</p>`, indent);
                };
            };
            last_indent = indent;
        }
        //console.log(html);
        return html.join(`\n`);// + `\n<li>&#160;</li>`;
    }
    filter_and_family(condition, omit_anc, keep_desc) {
    // used for showing updates to project notes and stuff like that. lets you
    // show only the content that fulfills the specified condition, and the
    // family relevant to that content.
    // - condition: the test for whether a bullet is valid or not. it can be...
    //   - a (bullets, index) function
    //   - a DDmmmYY date: keeps bullets on or past that date.
    //   - two dates: keeps bullets on or past the first date, but before the
    //     second.
    // - omit_anc, keep_desc: booleans for whether it should keep bullets that
    //   are invalid, but ancestors or descendants of valid bullets.
    //   - if a bullet is both ancestor and descendant, it'll be kept if
    //     omit_anc is off or keep_desc is on.
    //   - NOTE: omit_anc will affect the indents of valid bullets, so that
    //     there's no inconsistencies in indents that break the rules or mislead
    //     as to which bullets are the children of which.
    // - the object it returns is:
    //   - content: new Bullets with nothing but valids and the family bullets
    //     you wanted.
    //   - anc, desc, both: arrays of indexes for bullets that are only kept
    //     because they're ancestors/descendants of valid bullets. use them in
    //     the Bullets.html edits argument.
    //     - these might be omitted depending on omit_anc/keep_desc, obviously
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let date = null;
        if(datechecker(condition)) {
        // one date: condition is "bullets since this date"
            date = condition;
            condition = function(bullets, index) {
                let temp = bullets.getdate(index);
                return temp && datecompare(date, temp, true) >= 0;
            };
        }
        else if(Array.isArray(condition) && condition.length === 2 && datechecker(condition[1])) {
            if(condition[0] === null) {
            // null and a date: condition is "bullets until this date"
                date = condition[1];
                condition = function(bullets, index) {
                    let temp = bullets.getdate(index);
                    return temp && datecompare(date, temp, true) < 0;
                };
            }
            else if(datechecker(condition[0])) {
            // two dates: condition is "bullets since the first date, but after the
            // second date"
                date = structuredClone(condition);
                condition = function(bullets, index) {
                    let temp = bullets.getdate(index);
                    return temp && datecompare(date[0], temp, true) >= 0 && datecompare(date[1], temp, true) < 0;
                };
            }
        }
        let length = this.length;
        let array = [];
        // an array of strings for each bullet.
        // - "valid", "invalid": meets or doesn't meet the condition
        // - "anc", "desc", "both": doesn't meet the condition, but is the
        //   ancestor or descendant of a bullet that does.
        for(i1 = 0; i1 < length; i1++) {
            array[i1] = condition(this, i1) ? "valid" : "invalid";
        }
        for(i1 = 0; i1 < length; i1++) {
            if(array[i1] === "valid") {
                let desc = this.desc(i1);
                for(i2 = 0; i2 < desc.length; i2++) {
                    let _i2 = desc[i2];
                    if(array[_i2] === "invalid") {
                        array[_i2] = "desc";
                    }
                    else if(array[_i2] === "anc") {
                        array[_i2] = "both";
                    };
                }
                let anc = this.anc(i1);
                for(i2 = 0; i2 < anc.length; i2++) {
                    let _i2 = anc[i2];
                    if(array[_i2] === "invalid") {
                        array[_i2] = "anc";
                    }
                    else if(array[_i2] === "desc") {
                        array[_i2] = "both";
                    };
                }
            };
        }
        let obj = {
            content: new Bullets(this),
            anc: [],
            desc: [],
            both: [],
        };
        for(i1 = 0; i1 < length; i1++) {
            obj.content[i1] = structuredClone(this[i1]);
        }
        // clone
        let removed = [];
        // array of what indexes to delete
        let temp = null;
        if(omit_anc) {
        // these have to be done separately, so that the descendants can be
        // flattened.
            for(i1 = 0; i1 < array.length; i1++) {
                if(
                    array[i1] === "anc"
                    ||
                    (array[i1] === "both" && !keep_desc)
                ) {
                    removed[removed.length] = i1;
                };
            }
            removed = obj.content.remove(removed, true);
            for(i1 = temp.length - 1; i1 >= 0; i1--) {
                array.splice(removed[i1], 1);
            }
            // adjust the string array
            removed = [];
        }
        for(i1 = 0; i1 < array.length; i1++) {
            if(
                array[i1] === "invalid"
                ||
                (array[i1] === "desc" && !keep_desc)
            ) {
                removed[removed.length] = i1;
            };
        }
        removed = obj.content.remove(removed);
        for(i1 = removed.length - 1; i1 >= 0; i1--) {
            array.splice(removed[i1], 1);
        }
        // adjust the string array
        for(i1 = 0; i1 < array.length; i1++) {
            if(array[i1] === "anc" || array[i1] === "desc" || array[i1] === "both") {
                obj[array[i1]][ obj[array[i1]].length ] = i1;
            };
        }
        // fill obj.anc, desc, and both
        if(omit_anc) {
            delete obj.anc;
        };
        if(!keep_desc) {
            delete obj.desc;
        };
        if(omit_anc && !keep_desc) {
            delete obj.both;
        };
        return obj;
    }
    remove(indexes, flatten) {
    // deletes the bullets at all the indexes specified, shifting index numbers
    // and dividers accordingly.
    // - flatten: if true, when a deleted index has descendants, it'll lower the
    //   indent level of those descendants instead of deleting them entirely.
    // - it also returns an array of all the indexes it deleted, so that arrays
    //   matching the bullets can be adjusted.
    //   - this sounds redundant, but remember that descendants are deleted too.
        let i1 = 0;
        let i2 = 0;
        if(typeof indexes === "number") {
            indexes = [indexes];
        };
        indexes.sort((a, b) => a - b);
        let _indexes = [];
        // have to put off deleting these, since missing bullets might screw up
        // desc_length. how annoying.
        let length = this.length;
        for(i1 = 0; i1 < indexes.length; i1++) {
            let _i1 = indexes[i1];
            if(!_indexes.includes(_i1)) {
            // if it hasn't been marked for deletion already...
                _indexes[_indexes.length] = _i1;
                let desc_length = this.desc_length(_i1);
                for(i2 = 0; i2 < desc_length; i2++) {
                    let _i2 = _i1 + 1 + i2;
                    if(flatten) {
                        this[_i2].indent--;
                    }
                    else {
                        _indexes[_indexes.length] = _i2;
                    };
                }
            }
            let heir = this.nextsibling(_i1);
            // index to move the dividers to.
            // - since i did this after the flattening, this could end up being
            //   a flattened child, but that makes plenty of sense.
            if(heir !== null) {
            // pass on dividers and newpara
                this[heir].dividers = Bullets.fixdividers(this[_i1].dividers.concat( this[heir].dividers ));
                // fixdividers avoids multiple dates, or empty = sections
                if(!this[heir].newpara) {
                    this[heir].newpara = this[_i1].newpara;
                }
            };
        }
        for(i1 = 0; i1 < _indexes.length; i1++) {
            delete this[ _indexes[i1] ];
        }
        let gap = 0;
        for(i1 = 0; i1 < length; i1++) {
        // move bullets to get rid of all empty slots. (index keeps track of
        // where bullets should be moved to for there to be no gaps.)
            if(this.hasOwnProperty(i1)) {
                if(gap) {
                // shift it to the other side
                    let _i1 = i1 - gap;
                    if(this.hasOwnProperty(_i1)) {
                        console.log("this shouldn't happen");
                    }
                    else {
                        this[_i1] = structuredClone(this[i1]);
                        delete this[i1];
                    };
                }
            }
            else {
            // empty slot
                gap++;
            };
        }
        return _indexes;
    }
    static intent_tags(string, realizers) {
    // returns an array of objects for each valid center/intent/realizer tag
    // inside the string.
    // - type: string for which realizer it is, or if it's center/intent
    // - parenter:
    //   - string: use the most recent/relevant intent that contains that
    //     string.
    //   - array of strings: create an intent with these words, and parent it to
    //     that.
    //   - null: parent it to the closest ancestor that's a center/intent or a
    //     realizer of the same type.
    //   - empty string: parent it to the center.
    // - content: the text content of the realizer, whether that's the
    //   simplified text, a portion of it, or something different specified
    //   inside the tag
        let i1 = 0;
        let i2 = 0;
        realizers ??= [];
        string = trimunspecial(string);
        // collapse redundant whitespace
        let ranges = block_ranges(string, false, "(", ")");
        // split into parenthesed and unparenthesed content
        let tags = [];
        // objects it'll return
        let between = [""];
        // strings between tags
        // - [0] is the content before tags[0], etc
        // - it's simplified. trimspecial-ed, and parenthesed content is
        //   removed
        for(i1 = 0; i1 <= ranges.length; i1++) {
            let block = string_block(string, ranges, i1).trim();
            let addtobetween = !(i1%2);
            if(!addtobetween) {
            // parenthesed content
                if(!block.startsWith("(") || !block.endsWith(")")) {
                    console.log("this shouldn't happen");
                }
                let phrase = block.slice(1, -1);
                let type = "";
                for(i2 = -2; i2 < realizers.length; i2++) {
                    let _type = i2 === -2 ? "center" : i2 === -1 ? "intent" : realizers[i2];
                    if(phrase.startsWith(_type) && (!type || _type.length > type.length)) {
                        type = _type;
                    }
                }
                if(type) {
                    phrase = phrase.slice(type.length).trim();
                    let error = false;
                    // flips on when it can tell it's unreadable because of
                    // syntax errors.
                    let parenter = null;
                    if(phrase.startsWith("#")) {
                        parenter = [];
                        let end = phrase.length;
                        let enders = "<>:";
                        for(i2 = 0; i2 < enders.length; i2++) {
                            let temp = phrase.indexOf(enders[i2]);
                            if(temp !== -1 && temp < end) {
                                end = temp;
                            }
                        }
                        parenter = phrase.slice("#".length, end).split("#");
                        phrase = phrase.slice(end).trim();
                        for(i2 = 0; i2 < parenter.length; i2++) {
                            parenter[i2] = parenter[i2].trim();
                        }
                    }
                    if(phrase.startsWith("[")) {
                        if(parenter) {
                            console.log("tag-created intents and attachments contradict each other, so the latter is thrown out.");
                        }
                        else {
                            let ranges = block_ranges(phrase, false, "[", "]");
                            if(ranges.length >= 2 && !ranges[0]) {
                                parenter = string_block(phrase, ranges, 1).slice(1, -1);
                                phrase = phrase.slice(ranges[1]);
                            }
                            else {
                                //console.log("unknown attachment syntax. the way brackets are used makes it hard to understand what you're doing.");
                                error = true;
                            }
                        }
                    }
                    let direction = phrase === "<" ? -1 : phrase === ">" ? 1 : 0;
                    if(phrase.startsWith(":")) {
                        phrase = phrase.slice(1).trimStart();
                    }
                    else if(!phrase) {
                        phrase = null;
                    }
                    else if(direction) {
                        phrase = phrase.slice(1);
                        phrase = null;
                    }
                    else if(!direction) {
                        //console.log("after the type and attachment, the rest of the tag should be empty, <, >, or a colon followed by content. this is none of those.");
                        // it probably wasn't a tag at all, so don't pester them about it.
                        error = true;
                    };
                    // (type>), (type<), (type: blah blah blah shorthand),
                    // and (type) are all allowed. anything else isn't.
                    if(error) {
                        //addtobetween = true;
                        // nah, omit parenthesed content if it isn't tags.
                    }
                    else {
                        tags[tags.length] = {
                            type,
                            parenter,
                            direction,
                            content: phrase,
                            delete: false,
                        };
                        between[between.length] = "";
                    }
                }
            };
            if(addtobetween) {
                between[between.length - 1] += " ".repeat(!!between[between.length - 1]) + block;
            }
        }
        for(i1 = 0; i1 < tags.length; i1++) {
            if(tags[i1].delete) {
                //
            }
            else if(tags[i1].direction) {
            // < or >
                let sign = tags[i1].direction;
                let string = [];
                let over = false;
                for(i2 = i1 + sign; i2 >= 0 && i2 < tags.length && !over; i2 += sign) {
                // move up or down through the tags
                    string[string.length] = between[i2 + (sign === 1 ? 0 : sign === -1 ? 1 : null)];
                    // add the content between
                    if(
                        tags[i2].type === tags[i1].type
                        &&
                        compareobject(tags[i2].parenter, tags[i1].parenter)
                        &&
                        tags[i2].direction
                        &&
                        tags[i2].content === null
                    ) {
                    // stop when you see another < or > of the same type and
                    // parenter, and if it's the opposite direction, nullify it
                    // too. (since it'll end up being a duplicate.)
                        over = true;
                        if(tags[i2].direction === -sign) {
                            tags[i2].delete = true;
                        }
                    }
                }
                if(!over) {
                    if(sign === -1) {
                        string.splice(0, 0, between[0]);
                    }
                    else if(sign === 1) {
                        string[string.length] = between[between.length - 1];
                    }
                    else {
                        console.log("this shouldn't happen");
                    };
                }
                tags[i1].content = string.join(" ");
            }
            else if(tags[i1].content === null) {
            // a parenthesed type with nothing else
                tags[i1].content = between.join(" ");
            }
        }
        for(i1 = 0; i1 < tags.length; i1++) {
            if(tags[i1].delete) {
                tags.splice(i1, 1);
                i1--;
            }
            else {
                delete tags[i1].direction;
                delete tags[i1].delete;
                tags[i1].content = tags[i1].content.trim();
            }
        }
        return tags;
    }
    intent(realizers) {
    // something for my writing notes. a system of tagging what a given idea is
    // (ex: design, music, etc) but also assigning it to a given "center" idea
    // (usually a character) and something i'm trying to convey in that idea.
        let i1 = 0;
        let i2 = 0;
        let i3 = 0;
        let i4 = 0;
        let length = this.length;
        realizers ??= [];
        let tags = [];
        // an array of arrays or nulls. each index represents a bullet, and
        // the array of intent/realizer tags that bullet has. (or null if
        // there were none.)
        for(i1 = 0; i1 < length; i1++) {
            tags[i1] = null;
        }
        // but it'd be wasteful to run that on every single bullet, plus they
        // need centers to revolve around anyway.
        let centers = [];
        let lengths = [];
        // starts and lengths of each center's branch. (add 1 to the lengths, to
        // include the main bullet)
        function filltags(_this, index) {
        // fills tags by running intent_tags on each descendant of the center
        // index specified.
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            let desc_length = _this.desc_length(index);
            for(i1 = index; i1 < index + 1 + desc_length; i1++) {
                if(!tags[i1]) {
                    tags[i1] = Bullets.intent_tags(_this[i1].text, realizers);
                };
                if(!tags[i1].length) {
                    tags[i1] = null;
                }
                else if(tags[i1] && tags[i1].some((element) => element.type === "center")) {
                // keep track of all the centers, and also make sure there's
                // only one center per bullet
                    centers[centers.length] = i1;
                    lengths[lengths.length] = _this.desc_length(i1);
                    let bool = true;
                    for(i2 = 0; i2 < tags[i1].length; i2++) {
                        if(tags[i1][i2].type === "center") {
                            if(bool) {
                                bool = false;
                            }
                            else {
                                tags[i1][i2].type = "intent";
                            };
                        };
                    }
                };
            }
        }
        for(i1 = 0; i1 < length; i1++) {
            if(this[i1].text.includes("(center")) {
                tags[i1] = Bullets.intent_tags(this[i1].text);
                if(tags[i1].some((element) => element.type === "center")) {
                    filltags(this, i1);
                    i1 += this.desc_length(i1);
                }
                else {
                    tags[i1] = null;
                }
            }
        }
        // fill tags, center, lengths
        let tci = [];
        // "tag-created intents", an array for intents created by the # system.
        // - you know, where "(desi #strong)" would get parented to a new intent
        //   that says "strong"
        // - structure of each one is:
        //   - content: the words that created it, an array of strings
        //   - sorted: copy of content with .sort() run on it, so it compares
        //     better. gets deleted later
        //   - children: an array of [bullets index, tag index] arrays for which
        //     bullets to parent to it later. (this is also used to get the
        //     date.)
        //   - center: index of the center it's assigned to (index in the
        //     Bullets, not the centers array.)
        function parenttag(_this, _tags, tci_length, center, index) {
        // finds and creates the .parent of all of one bullet's tags.
            let i1 = 0;
            let i2 = 0;
            let i3 = 0;
            let i4 = 0;
            let anc = _this.anc(index)
            let assumed = index === center ? index : anc.findLast(
                (element) => _tags[element] && _tags[element].some(
                    (element) => element.type === "center" || element.type === "intent"
                )
            );
            // this is the intent to bind it to, if there's no
            // attachment string or same-realizer ancestor
            // - non-center tags within the main center bullet get parented to
            //   the main center.
            if(assumed === undefined) {
            // the way the logic has worked, this has to be the
            // descendant of a center, so obviously something went
            // wrong.
                console.log("this shouldn't happen");
            }
            else {
                let temp = _tags[assumed].findIndex((element) => element.type === "center");
                if(temp === -1) {
                    temp = _tags[assumed].findIndex((element) => element.type === "intent");
                    if(temp === -1) {
                        console.log("this shouldn't happen");
                    }
                }
                // centers outweigh intents. (otherwise, if a center has an
                // intent tag in it's bullet, everything could end up parenting to that instead.)
                assumed = [assumed, temp];
            };
            let own_intent = _tags[index].findIndex((element) => element.type === "center" || element.type === "intent");
            // the first intent tag inside this bullet, if it has any. if you
            // define an intent and realizer in the same bullet, the realizer
            // should parent to the intent.
            for(i1 = 0; i1 < _tags[index].length; i1++) {
                let tag = _tags[index][i1];
                let parenter = structuredClone(tag.parenter);
                delete tag.parenter;
                tag.parent = null;
                if(Array.isArray(parenter)) {
                // add this to the tci if it doesn't exist, and add
                // this bullet to its children instead of setting this bullet's
                // parent.
                    let sorted = structuredClone(parenter);
                    sorted.sort();
                    let tci_index = -1;
                    for(i2 = tci_length; i2 < tci.length && tci_index === -1; i2++) {
                    // check if there's already a created tag like this
                        let ref = structuredClone(tci[i2].sorted);
                        if(
                            ref.length === sorted.length
                            &&
                            ref.every((element, _index) => element === sorted[_index])
                        ) {
                        // compare the sorted versions, so it doesn't matter if
                        // the order is different
                            tci_index = i2;
                        }
                    }
                    if(tci_index === -1) {
                        tci_index = tci.length;
                        tci[tci_index] = {
                            content: structuredClone(parenter),
                            sorted,
                            children: [],
                        }
                    }
                    let ref = tci[tci_index].children;
                    ref[ref.length] = [index, i1];
                }
                else {
                    if(parenter === "") {
                    // empty brackets mean to ignore inheritance.
                        let temp = tags[center].findIndex((element) => element.type === "center");
                        if(temp === -1) {
                            console.log("this shouldn't happen");
                        }
                        else {
                            tag.parent = [center, temp];
                        }
                    }
                    else if(typeof parenter === "string") {
                    // the tag specified which intent it wanted to be part of.
                        let matches = [];
                        for(i2 = 0; i2 < _tags.length; i2++) {
                            if(_tags[i2]) {
                                let temp = _tags[i2].findIndex((element) => (
                                    element.content.includes(parenter)
                                    &&
                                    (element.type === "center" || element.type === "intent" || element.type === tag.type)
                                ));
                                if(temp !== -1 && (i2 !== index || temp !== i1)) {
                                // avoid parenting to itself
                                    matches[matches.length] = [i2, temp];
                                }
                            }
                        }
                        let over = !matches.length;
                        for(i2 = 0; i2 < 4 && !over; i2++) {
                            if(matches.length === 0) {
                                if(i2) {
                                    console.log("this shouldn't happen: " + i2);
                                }
                                over = true;
                            }
                            else if(matches.length === 1) {
                                tag.parent = structuredClone(matches[0]);
                                over = true;
                            }
                            else if(i2 === 0) {
                            // keep the ones that have the closest common ancestor.
                                let level = anc.findLastIndex(
                                    (a) => matches.some(
                                        (b) => _this.anc(b[0]).includes(a)
                                    )
                                )
                                if(level === -1) {
                                    console.log("this shouldn't happen");
                                }
                                else {
                                    matches = matches.filter((element) => _this.anc(element[0]).includes(anc[level]));
                                }
                            }
                            else if(i2 === 1) {
                                // keep only the ones with the lowest indent.
                                matches.sort( (a, b) => _this[a[0]].indent - _this[b[0]].indent );
                                let record = _this[ matches[0][0] ].indent;
                                matches.filter((element) => _this[ element[0] ].indent === record);
                            }
                            else if(i2 === 2) {
                                // pick the one with the lowest index.
                                matches.sort((a, b) => a[0] - b[0]);
                                matches = [matches[0]];
                            }
                        }
                    }
                    else if(tag.type !== "center" && tag.type !== "intent") {
                        // if a parent and child bullet both have tags and are the same
                        // realizer type, that's used instead of the intent.
                        let over = false;
                        for(i2 = anc.length - 1; i2 >= 0 && !over; i2--) {
                            if(_tags[ anc[i2] ]) {
                                let temp = _tags[ anc[i2] ].findIndex((element) => element.type === tag.type);
                                if(temp !== -1) {
                                    tag.parent = [anc[i2], temp];
                                }
                                over = true;
                                // give up if there's a bullet between that doesn't
                                // match but has tags.
                            }
                        }
                    };
                    if(tag.parent === null) {
                        if(index === center && tag.type === "center") {
                        // if it's the center, parent to a center ancestor, or leave it
                        // as null if there are none.
                            for(i2 = anc.length - 1; i2 >= 0 && tag.parent === null; i2--) {
                                if(_tags[ anc[i2] ]) {
                                    let temp = _tags[ anc[i2] ].findIndex((element) => element.type === "center");
                                    if(temp !== -1) {
                                        tag.parent = [anc[i2], temp];
                                    }
                                }
                            }
                        }
                        else if(own_intent !== -1 && tag.type !== "center" && tag.type !== "intent") {
                        // if there's both an intent and realizers, parent the
                        // realizer to the intent
                            tag.parent = [index, own_intent];
                        }
                        else {
                        // otherwise, just stick with the closest intent ancestor.
                            tag.parent = structuredClone(assumed);
                        };
                    };
                }
            }
        }
        for(i1 = 0; i1 < centers.length; i1++) {
            let start = centers[i1];
            let end = centers[i1] + 1 + lengths[i1];
            let _tags = [];
            for(i2 = 0; i2 < length; i2++) {
            // make a new tree that's nothing but this branch
                if(i2 >= start && i2 < end) {
                    _tags[i2] = structuredClone(tags[i2]);
                }
                else {
                    _tags[i2] = null;
                }
            }
            for(i2 = 0; i2 < centers.length; i2++) {
            // clear stuff in subbranches too.
                let _start = centers[i2];
                let _end = centers[i2] + 1 + lengths[i2];
                if(i2 !== i1 && _start >= start && _end <= end) {
                    for(i3 = _start; i3 < _end; i3++) {
                        _tags[i3] = null;
                    }
                }
            }
            let tci_length = tci.length;
            // how long it was before this branch.
            for(i2 = 0; i2 < _tags.length; i2++) {
                if(_tags[i2]) {
                    parenttag(this, _tags, tci_length, centers[i1], i2);
                }
            }
            // find the parent to put it under
            for(i2 = 0; i2 < _tags.length; i2++) {
                if(_tags[i2]) {
                    tags[i2] = structuredClone(_tags[i2]);
                }
            }
            // apply changes to the main list
            let temp = tci.slice(tci_length);
            //temp.sort((a, b) => a.content.length - b.content.length)
            // - this sounds great and all, but i'd have to only sort tcis that
            //   have the same date. ...i'm not doing that.
            for(i2 = 0; i2 < temp.length; i2++) {
                delete temp[i2].sorted;
                temp[i2].center = centers[i1];
            }
            tci = tci.slice(0, tci_length).concat(temp);
        }
        let newbul = new Bullets(this);
        let template = Bullets.template;
        let added = [];
        let added_tci = [];
        for(i1 = 0; i1 < length; i1++) {
            added[i1] = !tags[i1];
        }
        for(i1 = 0; i1 < tci.length; i1++) {
            added_tci[i1] = false;
        }
        function addchildren(_this, children, type, tcis, level) {
        // input an array of [index, subindex] arrays, and it'll run addtonew on
        // them, sorting by type, adding dividers, and inserting tcis.
        // - tcis: array of tcis indexes
            let i1 = 0;
            let i2 = 0;
            tcis ??= [];
            level ??= 0;
            let _children = [];
            let breaks = [];
            let tci_insert = -1;
            for(i1 = -2; i1 < realizers.length; i1++) {
                let type = i1 === -2 ? "center" : i1 === -1 ? "intent" : realizers[i1];
                let bool = false;
                for(i2 = 0; i2 < children.length; i2++) {
                    if(tags[ children[i2][0] ][ children[i2][1] ].type === type) {
                        if(!bool) {
                            breaks[breaks.length] = _children.length;
                            bool = true;
                        }
                        _children[_children.length] = [children[i2][0], children[i2][1]];
                    }
                }
                if(type === "center") {
                    tci_insert = _children.length;
                }
            }
            let bool = false;
            // skip the first divider
            for(i1 = 0; i1 <= _children.length; i1++) {
                if(i1 === tci_insert) {
                // add tcis
                    for(i2 = 0; i2 < tcis.length; i2++) {
                        addtci(_this, tcis[i2], !i2 && bool, level + 1);
                        bool = true;
                    }
                };
                if(i1 < _children.length) {
                    addtonew(_this, _children[i1][0], _children[i1][1], type, breaks.includes(i1) && bool, level + 1);
                    bool = true;
                };
            }
        };
        function addtonew(_this, old_index, subindex, parent_type, divider, level) {
            let i1 = 0;
            let i2 = 0;
            level ??= 0;
            added[old_index] = true;
            let new_index = newbul.length;
            newbul[new_index] = structuredClone(template);
            let bullet = newbul[new_index];
            let tag = tags[old_index][subindex];
            if(tag.type === "center" || (tag.type !== "intent" && tag.type !== parent_type)) {
            // centers always show, intents never do, realizers don't show if
            // they match the parent
                bullet.text = tag.type + ": ";
            }
            bullet.text += tag.content;
            bullet.indent = level;
            bullet.character = _this[old_index].character;
            if(divider) {
                bullet.dividers[bullet.dividers.length] = "=";
            };
            let assumed_date = newbul.getdate(new_index);
            let date = _this.getdate(old_index);
            if(date !== null && date !== assumed_date) {
                bullet.dividers[bullet.dividers.length] = date;
            }
            //
            function findchildren(index, subindex) {
            // returns an array of [index, subindex] arrays.
                let children = [];
                for(let i1 = 0; i1 < tags.length; i1++) {
                    if(tags[i1]) {
                        for(let i2 = 0; i2 < tags[i1].length; i2++) {
                            let _tag = tags[i1][i2];
                            if(Array.isArray(_tag.parent) && _tag.parent[0] === index && _tag.parent[1] === subindex) {
                                if(i1 === index && i2 === subindex) {
                                // means it was parented to itself, which would
                                // cause an infinite loop
                                    console.log("this shouldn't happen");
                                }
                                else {
                                    children[children.length] = [i1, i2];
                                }
                            }
                        }
                    }
                }
                return children;
            }
            let tcis = [];
            if(tag.type === "center") {
                for(i1 = 0; i1 < tci.length; i1++) {
                    if(tci[i1].center === old_index) {
                        tcis[tcis.length] = i1;
                    }
                }
            }
            addchildren(_this, findchildren(old_index, subindex), tag.type, tcis, level);
        }
        function addtci(_this, tci_index, divider, level) {
        // add a bullet made from a tci.
            let i1 = 0;
            let i2 = 0;
            level ??= 0;
            added_tci[tci_index] = true;
            let tag = tci[tci_index];
            if(!tag.children.length) {
                console.log("this shouldn't happen");
                return;
            }
            let eldest = -1;
            let date = null;
            // index and date of the child with the earliest date. (null dates
            // are earlier than any other date.)
            for(i1 = 0; i1 < tag.children.length; i1++) {
                let _i1 = tag.children[i1][0];
                let _date = _this.getdate(_i1);
                if(
                    eldest === -1
                    ||
                    (_date === date ? _i1 < eldest : (
                        _date === null
                        ||
                        datecompare(date, _date, true) === -1
                    ))
                ) {
                // it's the new oldest if:
                // - it's the first child
                // - it's the same as the current earliest date, but shows up
                //   earlier in the bullets
                // - there's no date
                // - the date comes before the current earliest
                    eldest = _i1;
                    date = _date;
                };
            }
            let new_index = newbul.length;
            newbul[new_index] = structuredClone(template);
            let bullet = newbul[new_index];
            bullet.text = tag.content.join(", ");
            bullet.indent = level;
            bullet.character = _this[eldest].character;
            if(divider) {
                bullet.dividers[bullet.dividers.length] = "=";
            };
            let assumed_date = newbul.getdate(new_index);
            if(date !== null && date !== assumed_date) {
                bullet.dividers[bullet.dividers.length] = date;
            }
            //
            addchildren(_this, tag.children, "intent", [], level);
        }
        for(i1 = 0; i1 < centers.length; i1++) {
            let subindex = tags[centers[i1]].findIndex((element) => element.type === "center")
            if(subindex === -1) {
                console.log("this shouldn't happen");
            }
            else if(tags[ centers[i1] ][ subindex ].parent === null) {
            // start with centers that have null parents.
            // - tags that are parented to tcis also have null parents, and
            //   some centers are children of other centers. it has to be
            //   both.
                addtonew(this, centers[i1], subindex);
            }
        }
        if(false) {
            for(i1 = 0; i1 < length; i1++) {
                if(!added[i1]) {
                    console.log(tags[i1]);
                }
            }
            for(i1 = 0; i1 < tci.length; i1++) {
                if(!added_tci[i1]) {
                    console.log(tci[i1]);
                }
            }
        }
        return newbul;
    }
    static fromarray(array, myformatting, retainbreaks, allowthese) {
    // converts an array of individual bullet objects into a Bullets.
        let newbul = new Bullets("", myformatting, retainbreaks, allowthese);
        delete newbul[0];
        for(let i1 = 0; i1 < array.length; i1++) {
            newbul[i1] = structuredClone(Bullets.template);
            if(typeof array[i1] === "string") {
            // if it's a string, take that as the .text
                newbul[i1].text = array[i1];
            }
            else if(typeof array[i1] === "object" && array[i1]) {
            // if it's an object, copy any properties that are allowed for
            // bullets
                for(let i2 in newbul[i1]) {
                    if(array[i1].hasOwnProperty(i2)) {
                        newbul[i1][i2] = structuredClone(array[i1][i2]);
                    }
                }
            };
        }
        return newbul;
    }
    publicize(_unmedia) {
    // removes spoiler tags and stuff
        let i1 = 0;
        let i2 = 0;
        let length = this.length;
        let remove = [];
        let hide = ["*", "spoil", "hide"];
        // remove these bullets and descendants
        let del = ["myti", "laf", "syn", "vis"];
        // delete these
        let zerothreshold = 5;
        for(i1 = 0; i1 < length; i1++) {
            let text = this[i1].text;
            let desc_length = this.desc_length(i1);
            let bool = false;
            // boolean for whether to remove it
            if(false && this[i1].indent === 0 && desc_length === 0) {
            // delete zero indent bullets with no descendants and
            // [zerothreshold] words or less (likely to be temporary notes.)
            // - NOTE: disabled because it's important enough considering how
            //   unpredictable it can be.
                let temp = 0;
                for(i2 = 0; i2 < text.length; i2++) {
                    if(text[i2].trim() && (i2 === 0 || !text[i2 - 1].trim())) {
                        temp++;
                    }
                }
                bool = temp <= zerothreshold;
            };
            if(!bool) {
                for(i2 = 0; i2 < hide.length; i2++) {
                    if(text.includes("(" + hide[i2] + ")")) {
                        bool = true;
                    }
                }
            };
            if(bool) {
                remove[remove.length] = i1;
                if(
                    this[i1].indent === 0
                    &&
                    desc_length === 0
                    &&
                    hide.includes(text.trim().slice(1, -1))
                    &&
                    text.trimStart().startsWith("(")
                    &&
                    text.trimEnd().endsWith(")")
                ) {
                // if it's a zero-indent with nothing but a hide tag and no
                // descendants,
                    if(
                        (this[i1 + 1].newpara || i1 === length - 1)
                        &&
                        (this[i1].dividers[this[i1].dividers.length - 1] ?? null) === "="
                    ) {
                    // if it has a = before it and it ends the paragraph, delete
                    // the whole paragraph.
                        for(let temp = this.prevsibling(i1); Number.isInteger(temp) && temp >= 0; temp = this.prevsibling(temp)) {
                            remove[remove.length] = i1;
                        }
                    }
                    else {
                    // otherwise, delete everything until the previous = or
                    // newpara.
                        for(let temp = this.prevsibling(i1); Number.isInteger(temp) && temp >= 0; temp = temp === null ? null : this.prevsibling(temp)) {
                            remove[remove.length] = i1;
                            if(this[temp].dividers.includes("=")) {
                                temp = null;
                            }
                        }
                    }
                }
                i1 += desc_length;
                // skip so the next iteration is after this bullet's last descendant
            }
            else {
                for(i2 = 0; i2 < del.length; i2++) {
                    text = text.replaceAll(" (" + del[i2] + ") ", " ");
                    text = text.replaceAll(" (" + del[i2] + ")", " ");
                    text = text.replaceAll("(" + del[i2] + ") ", " ");
                    text = text.replaceAll("(" + del[i2] + ")", "")
                    text = text.trim();
                }
                this[i1].text = _unmedia ? unmedia(text) : text;
            }
        }
        this.remove(remove);
    }
    static UI = class {
    // a class for subjecting a textarea to Bullets rules.
        constructor(textarea, container, prefix) {
            if(!(textarea instanceof HTMLTextAreaElement) || !(container instanceof HTMLElement) || (typeof prefix !== "string")) {
                console.log("invalid arguments.");
                return;
            }
            this.textarea = textarea;
            this.container = container;
            this.prefix = prefix;
            this.container.innerHTML = (
                addhtml(this.prefix, "input", "enabled", `type="checkbox" checked`, null, `enable Bullets features`) + `\n<ul id="lic_bui_` + tohtmlid(`hider`) + `">`
                + `\n\t\t` + addhtml(this.prefix, "input", "myformatting", `type="checkbox" checked`, null, `use my formatting`)
                + `\n\t\t<br>` + addhtml(this.prefix, "input", "allowthese", `type="text"`, null, `allow these characters as bullets`)
                + `\n\t\t<br>` + addhtml(this.prefix, "button", "minus indent", null, "- indent")
                + `\n\t\t` + addhtml(this.prefix, "button", "plus indent", null, "+ indent")
                + `\n</ul>`
            );
            //console.log(this.container.innerHTML);
            let _this = this;
            this.element("enabled").onchange = function() { _this.element("hider").hidden = !_this.element("enabled").checked };
            this.element("minus indent").onclick = function() { _this.changeindent(-1, _this) };
            this.element("plus indent").onclick = function() { _this.changeindent(1, _this) };
            this.textarea.onkeyup = function(e) {
                if(e.key !== "Enter" || !_this.enabled) {
                    return;
                }
                let cursor = _this.textarea.selectionEnd;
                let string = _this.textarea.value.slice(0, cursor);
                let newlines = 0;
                while(string.endsWith("\n")) {
                    newlines++;
                    string = string.slice(0, -1);
                };
                let lines = string.split("\n");
                let indent = -1;
                for(let i1 = lines.length - 1; i1 >= 0 && indent === -1; i1--) {
                    indent = Bullets.bulletstart(lines[i1], _this.myformatting, _this.allowthese);
                }
                if(indent > 0 && newlines) {
                    string = string.slice(0, string.length - newlines) + ( "\n" + " ".repeat( Bullets.spacenum(indent, false, false, _this.myformatting) ) ).repeat(newlines);
                    _this.textarea.value = string + _this.textarea.value.slice(cursor);
                    _this.textarea.selectionStart = string.length;
                    _this.textarea.selectionEnd = string.length;
                }
            }
        }
        element(name) {
            return document.getElementById(this.prefix + "_" + tohtmlid(name));
        }
        get enabled() {
            return this.element("enabled").checked;
        }
        get myformatting() {
            return this.element("myformatting").checked;
        }
        get allowthese() {
            return this.element("allowthese").value;
        }
        changeindent(num, _this) {
            let i1 = 0;
            let i2 = 0;
            _this ??= this;
            let lines = _this.textarea.value.slice(0, _this.textarea.selectionEnd).split("\n");
            let bulindex = 0;
            for(i1 = 0; i1 < lines.length; i1++) {
                bulindex += Bullets.bulletstart(lines[i1], _this.myformatting, _this.allowthese) !== -1;
            }
            bulindex--;
            let bullets = new Bullets(_this.textarea.value, _this.myformatting, false, _this.allowthese);
            console.log(bulindex);
            let temp = bullets.desc_length(bulindex);
            for(i1 = bulindex; i1 < bulindex + 1 + temp; i1++) {
                bullets[i1].indent = Math.max(0, bullets[i1].indent + num);
            }
            let width = _this.textarea.cols;
            let length = bullets.length;
            let cursor = 0;
            let output = "";
            for(i1 = 0; i1 < length; i1++) {
                output += (output ? "\n" : "") + bullets.stringat(i1, width, _this.myformatting, "all");
                if(i1 === bulindex) {
                    cursor = output.length;
                };
            }
            _this.textarea.value = output;
            _this.textarea.selectionStart = cursor;
            _this.textarea.selectionEnd = cursor;
        }
    }
};
function entityreplacement(input, leave_whitespace) {
// this isn't implemented anywhere yet, but in case i need it...
// - come to think of it, if you can type or paste < and > into a
//   textarea without it going poof this is probably only relevant to
//   text loaded from a file?
// - leave_whitespace: if true, it won't apply changes to line breaks, indents,
//   and consecutive spaces. (useful if this is meant to be in a <pre> element.)
    let entities = {
        "&": 38,
        "<": 60,
        ">": 62,
        '"': 34,
        "'": 39,
    };
    let i1 = 0;
    for (i1 in entities) {
        if (entities.hasOwnProperty(i1)) {
            input = input.replaceAll(i1, "&#" + entities[i1] + ";");
        }
    }
    for(i1 = 0; i1 < input.length; i1++) {
    // replace spaces after whitespace
        if(input[i1] === " ") {
            let slice = input.slice(0, i1);
            if(slice.endsWith("&#160;") || !slice.slice(-1).trim()) {
            // if the text up until now ends with a non-breaking space entity or
            // whitespace, or it's the beginning of the text, turn this into a
            // non-breaking space entity
                input = slice + "&#160;" + input.slice(i1 + 1);
                i1 += "&#160;".length - 1;
            };
        };
    }
    if(!leave_whitespace) {
        input.replaceAll("\n", "<br>");
        while(input.includes("\t")) {
            // replace all indents with <ul> elements
            let temp = input.indexOf("\t");
            if(temp === -1) {
                console.log("this shouldn't happen");
                input.replace("\t", "");
                // just to avoid it looping infinitely
            }
            else {
                temp = input.slice(0, temp) + (
                    input.lastIndexOf("<br>") > temp
                    // there's a <br> after the \t
                    ?
                    input.slice(temp).replace("\t", "<ul>") + "</ul>"
                    // close it at the end of the string
                    :
                    input.slice(temp).replace("<br>", "</ul><br>").replace("\t", "<ul>")
                    // close it before that line break
                );
            };
        }
    }
    return input;
};
let quote = {
// stores functions related to quotes.
    ranges: function(string, omitends, comments,/*start, end, keepend*/ escapedtext) {
    // creates an array of indexes for when it enters and exits quotes, used
    // to check if a particular index was in quotes.
    // - omitends: if false, quote characters will be included in the quotes.
    // - comments: arguments for comments.
    //   - start, end: characters that start/end it
    //   - keepend: whether to include the end string (should be true if it's
    //     something like /* */, false if it ends at a new line like //)
    // - escapedtext: means it's something like a JSON.stringify, where
    //   characters get replaced by escape codes.
    //   - be careful about using this if you don't know a lot about escape
    //     codes. it's not quite what it seems.
    //   - but if i was forced to sum it up; codes like "\n" are not something
    //     you choose whether or not to include. String.fromCharCode(10) is "\n"
    //     and "\n" is String.fromCharCode(10). even iterating by character, it
    //     will work like that.
    //     - if you're seeing escape codes, what you're actually seeing is \\n.
    //       \\ is the code for a single backslash that isn't part of an escape
    //       sequence. they turn up in places like JSON.stringify because it's a
    //       string meant to be used as code or something like that. \\n
    //       displays as \n, which means it looks correct for code meant to
    //       define a line break.
        let c = null;
        // comment parameters
        if(comments) {
            if(!Array.isArray(comments)) {
                comments = [];
            };
            c = {
                start: comments[0] ?? "//",
                end: comments[1] ?? String.fromCharCode(10),
            };
            c.keepend = comments[2] ?? (c.end === String.fromCharCode(10));
        };
        let quotes = null;
        // stores which kind of quotes it's in
        let comment = null;
        // index a comment started at
        let array = [];
        // array of quote beginnings/endings
        const quotecodes = [34, 39, 96];
        let loop = new Loop("quote.ranges", string.length + 1);
        for(let i1 = 0; i1 < string.length; i1++) {
            loop.tick(1, {string, omitends, comments: c, escapedtext});
            let char = string.charCodeAt(i1);
            if(quotes) {
            // quotes
                if(char === quotes && (!escapedtext || !i1 || string[i1 - 1] !== "\\")) {
                // exit quotes (ignore if it's \\" or something like that.)
                    quotes = null;
                    array[array.length] = i1 + !omitends;
                }
            }
            else if(c && string.slice(i1).startsWith(c.start)) {
            // ignore comments
                let temp = [];
                temp[0] = i1 + c.start.length;
                // index to start looking for the end of the comment
                temp[1] = string.slice(temp[0]).indexOf(c.end);
                temp = temp[1] === -1 ? string.length : temp[0] + temp[1] + !c.keepend*c.end.length;
                // end of the comment
                i1 = temp - 1;
                // skip to the end, make sure the next iteration is after the
                // comment
            }
            else if(quotecodes.includes(char) && (!escapedtext || !i1 || string[i1 - 1] !== "\\")) {
            // enter quotes (ignore if it's \\")
                quotes = char;
                array[array.length] = i1 + !!omitends;
            };
        }
        loop.end();
        return array;
    },
    ranges_arg: function(string, args) {
    // for any functions that have a quote_ranges argument, you can also input
    // an array of arguments.
        if(Array.isArray(args)) {
        // even if it's an empty array, it's assumed to be an empty quote.ranges.
            for(let i1 = 0; i1 < args.length; i1++) {
                if(!Number.isInteger(args[i1]) || args[i1] < 0 || args[i1] >= args.length) {
                    return quote.ranges(string, ...args);
                }
            }
            return args;
            // if it's an array of string indexes, assume it's the output of
            // quote.ranges. otherwise, assume it's an array of arguments.
        }
        else {
            return quote.ranges(string);
        };
    },
    block: function(string, quote_ranges, index, startend) {
    // returns the block at the given index.
    // - one of those functions that's only used in the other functions, for the
    //   sake of DRY.
    // - startend: if true, it returns slice indexes instead.
        quote_ranges = quote.ranges_arg(string, quote_ranges);
        //quote_ranges ??= quote.ranges(string);
        let temp = [
            index === 0 ? 0 : quote_ranges[index - 1],
            index === quote_ranges.length ? string.length : quote_ranges[index]
        ];
        return startend ? temp : string.slice(...temp);
    },
    edit: function(string, quote_ranges/*[omitends, comments, escapedtext]*/, code/*(string, inquotes)*/) {
    // applies edits only to content out of quotes. (or in quotes, if inquotes
    // is on.)
    // - code should be a (string, inquotes) function that returns a modified
    //   version of the block. this will be applied to every quote/nonquote
    //   block of text.
        let ranges = quote.ranges_arg(string, quote_ranges);
        let quotes = [];
        let nonquotes = [];
        let output = "";
        for(let i1 = 0; i1 <= ranges.length; i1++) {
            let slice = [
                (i1 ? ranges[i1 - 1] : 0),
                (i1 < ranges.length ? ranges[i1] : string.length)
            ];
            slice = string.slice(...slice);
            slice = code(slice, !!(i1%2)) ?? slice;
            // 0 to indexes[0] is a nonquote, the next is a quote, the next is a
            // nonquote, etc. so i1%2 === 1 means it's a quote block.
            output += slice;
            // later ranges numbers don't have to be adjusted, since it's making
            // a new string instead of editing the old one.
        }
        return output;
    },
};
function uncomment(string, start, end, keepend) {
// removes comments.
    start ??= "//";
    end ??= String.fromCharCode(10);
    keepend ??= end === String.fromCharCode(10);
    let code = function(string, inquotes) {
        if(inquotes) {
            return string;
        };
        for(let i1 = 0; i1 < string.length; i1++) {
            if(string.slice(i1).startsWith(start)) {
                // slice out the comment
                let temp = [];
                temp[0] = i1 + start.length;
                // index to start looking for the end of the comment
                temp[1] = string.slice(temp[0]).indexOf(end);
                temp = temp[1] === -1 ? string.length : temp[0] + temp[1] + !keepend*end.length;
                // end of the comment
                string = string.slice(0, i1) + string.slice(temp);
                i1--;
                // make sure the next iteration starts at the content after
                // the comment
            }
        }
        return string;
    };
    return quote.edit(string, [false, [start, end, keepend]], code);
};
function trimspecial(string, join) {
// trims the text and replaces all stretches of whitespace with a single space.
// - doesn't affect anything in quotes.
// - if join isn't a string, it'll return an array of words/quotes instead.
    string = string.trim();
    if(!string) {
        return typeof join === "string" ? "" : [];
    };
    let indexes = quote.ranges(string);
    let output = [];
    // array of words or quote blocks.
    for(let i1 = 0; i1 <= indexes.length; i1++) {
        let slice = [
            (i1 ? indexes[i1 - 1] : 0),
            (i1 < indexes.length ? indexes[i1] : string.length)
        ];
        let spaceless = slice[0] === 0 || string[slice[0] - 1].trim();
        // usually there's spaces before/after a quote. this means there is
        // not.
        slice = string.slice(...slice);
        if(i1%2) {
        // quotes
            if(spaceless) {
                output[output.length - 1] += slice;
            }
            else {
                output[output.length] = slice;
            }
        }
        else {
        // nonquotes; split it up by word
            if(!spaceless || output.length === 0) {
                // it should start by adding onto the last word, unless there
                // was a space or there is no last word
                output[output.length] = "";
            };
            slice = slice.trim();
            for(let i2 = 0; i2 < slice.length; i2++) {
                if(!slice[i2].trim()) {
                    // whitespace. start a new word, unless that already
                    // happened.
                    if(output[output.length - 1]) {
                        output[output.length] = "";
                    };
                }
                else {
                    output[output.length - 1] += slice[i2];
                }
            }
        }
    }
    return typeof join === "string" ? output.join(join) : output;
};
function codeindent(_string) {
// adds line breaks/indents at every [], {}, comma, and ;.
    let indent = 0;
    let newline = () => String.fromCharCode(10) + String.fromCharCode(9).repeat(Math.max(0, indent));
    //console.log("begin:");
    //console.log(_string);
    /*
    for(let i1 = 0; i1 < _string.length; i1++) {
        if(_string[i1] === "{" || _string[i1] === "[") {
            indent++;
        }
        else if(_string[i1] === "}" || _string[i1] === "]") {
            indent--;
            if(indent < 0) {
                console.log("negative:\n\n" + _string.slice(0, i1 + 1));
            }
        }
    }
    //*/
    let code = function(string, inquotes) {
        if(inquotes) {
            return string;
        };
        let output = "";
        for(let i1 = 0; i1 < string.length; i1++) {
            //console.log(i1);
            if(string.slice(i1).startsWith("{}") || string.slice(i1).startsWith("[]")) {
            // don't bother if it's [] or {}.
                output += string[i1];
                i1++;
                output += string[i1];
            }
            else {
                if(string[i1] === "}" || string[i1] === "]") {
                    indent--;
                    if(indent < 0) {
                        console.log("this shouldn't happen");
                    }
                    output += newline();
                }
                //
                output += string[i1];
                //
                if(string[i1] === "{" || string[i1] === "[") {
                    indent++;
                    output += newline();
                }
                else if(string[i1] === "," || string[i1] === ";") {
                    output += newline();
                }
                else if(string[i1] === ":" && (i1 + 1 >= string.length || string[i1 + 1].trim())) {
                    output += " ";
                };
            }
        }
        return output;
    }
    _string = quote.edit(_string, null, code).trim();
    return _string;
};
function displaylineardata(data, w, chars) {
// for stuff that's like a long array of booleans or something, meant to
// represent 2d data.
// - w is how long one row of the data is
// - chars is a string for what the values should be converted to. (ex: "-o"
//   means 0 or false values will be written as "-", 1 or true values will be
//   written as "o")
    w ??= data.length;
    chars ??= "-o";
    let text = [];
    for(let i1 = 0; i1 < data.length; i1++) {
        let row = Math.floor(i1/w);
        text[row] ??= "";
        text[row] += (
            typeof chars === "function"
            ?
            chars(data[i1])
            :
            chars[Number(data[i1])]
        );
    }
    return text.join(String.fromCharCode(10));
};
function bracketindent(input) {
// useful when paired with JSON.stringify.
// - if you input an object, it uses the stringify.
    let i1 = 0;
    let i2 = 0;
    if(typeof input === "object") {
        input = JSON.stringify(input);
    };
    indent = 0;
    output = "";
    let newline = () => String.fromCharCode(10) + String.fromCharCode(9).repeat(indent);
    let quotes = null;
    for (i1 = 0; i1 < input.length; i1++) {
        if([34, 39, 96].includes(input.charCodeAt(i1))) {
        // enter/exit quotes
            let temp = input.charCodeAt(i1);
            quotes = (
                quotes === null ? temp :
                quotes === temp ? null :
                quotes
            );
        };
        if(!quotes) {
            if(["}", "]"].includes(input.charAt(i1))) {
                indent--;
                output += newline();
            }
        }
        //
        output += input.charAt(i1);
        //
        if(!quotes) {
            if(["{", "["].includes(input.charAt(i1))) {
                indent++;
                output += newline();
            }
            else if([",", ";"].includes(input.charAt(i1))) {
                output += newline();
            }
            else if(input.charAt(i1) === ":" && input.charAt(i1 + 1) !== " ") {
                output += " ";
            };
        }
    }
    const escape = {
        ["\\t"]: 9,
        ["\\n"]: 10,
        ["\\f"]: 12,
        ["\\r"]: 13,
        ["\\v"]: 15,
    };
    for(i1 in escape) {
        if(escape.hasOwnProperty(i1)) {
            //output = output.split(i1).join(String.fromCharCode(escape[i1]));
        };
    }
    return output.trim();
}
//
/*
function objtotext(obj) {
    let temp = quote.edit(
        JSON.stringify(obj), [false, null, true],
        function(string, inquotes) {
            if(inquotes) {
                console.log(string.split(""));
                string = '"' + string + '"';
                //console.log(string.split(""));
                return JSON.parse(string);
            }
        }
    )
    return codeindent(temp);
}
function objtotext(obj) {
    let code = function(string, inquotes) {
        if(inquotes) {
            console.log(string);
        };
        return inquotes ? '"' + (string ? JSON.parse(string).replaceAll('"', '\\"') : string) + '"' : string;
    }
    return codeindent(
        quote.edit(
            JSON.stringify(obj), [false, null, true],
            code
        )
    )
}
//*/
//*
let objtotext = (obj) => codeindent(
    quote.edit(
        JSON.stringify(obj), [false, null, true],
        (string, inquotes) => inquotes ? '"' + (string ? JSON.parse(string).replaceAll('"', '\\"') : string) + '"' : string
    )
);
//*/
//*
let texttoobj = (text) => JSON.parse(
    quote.edit(
        trimspecial(text, " "), null,
        (string, inquotes) => inquotes ? JSON.stringify(string.slice(1, -1).replaceAll('\\"', '"')) : string
    )
);
//*/
// converts objects to text and back, except unlike JSON.stringify it doesn't
// look like shit. harder than it looks.
// - to text
//   - JSON.stringify
//   - for all quotes
//     - JSON.parse: gets rid of escapes (ex: "\\n" becomes just "\n", an actual
//       line break)
//       - JSON.parse doesn't work on empty strings, by the way. in case you
//         were wondering what was with that ( ? : ).
//     - escape the "s
//     - add "s on the ends
//     =
//     - the "s stay escaped because JSON.stringify('po"op') = 'po\\"op', and
//       '"' + JSON.parse('po\\"op') + '"' = '"po"op"'. it would screw up when
//       trying to read that string later, since the center " looks like a
//       string boundary
//   - codeindent: gives it a nice indented structure
// - to object
//   - trimspecial: reverses codeindent by compressing whitespace outside of
//     quotes
//   - for all quotes
//     - slice off ends
//     - replace \\" with "
//     - JSON.stringify
//   - JSON.parse
function objtocode(value) {
// might replace this later
    let i1 = 0;
    if(typeof value !== "object" || value === null) {
        return JSON.stringify(value);
    };
    let text = [];
    if(Array.isArray(value)) {
        if(value.length) {
            for(i1 = 0; i1 < value.length; i1++) {
                text[i1] = objtocode(value[i1]).replaceAll("\n", "\n\t");
            }
            text = "[\n\t" + text.join(",\n\t") + "\n]";
        }
        else {
            text = "[]";
        }
    }
    else {
        for(i1 in value) {
            if(value.hasOwnProperty(i1)) {
                text[text.length] = JSON.stringify(i1) + ": " + objtocode(value[i1]).replaceAll("\n", "\n\t") + ",";
            }
        }
        text = "{\n\t" + text.join("\n\t") + "\n}";
    }
    return text;
};
//
function tohtmlid(string) {
    //return string.replaceAll(" ", "_");
    return trimspecial(string.replaceAll(".", " ").replaceAll("/", " "), "_");
};
function addhtml(prefix, type, name, settings, inside, label) {
// - name: can be an array of [name, id]
//   - NOTE: name is not the literal property named "name", it's just what to
//     write for labels and stuff.
// - settings: string to insert inside the opening tag.
// - inside: contents of the element
    let id = null;
    if(Array.isArray(name)) {
        id = name[1];
        name = name[0];
    }
    else if(typeof name === "string") {
        id = name;
    };
    id = id ? tohtmlid(id) : id;
    settings = settings ? ` ` + settings : ``;
    if(type === "button") {
        inside ??= name;
    };
    inside = (
        inside
        ?
        (
            type === "div"
            ?
            `\n\t` + inside.replaceAll(`\n`, `\n\t`) + `\n`
            :
            inside
        )
        :
        ``
    );
    let nolabel = type === "button" || type === "div";
    let br = type === "textarea";
    let closer = type === "input" ? `` : `</` + type + `>`;
    return (
        (
            nolabel ? `` :
            `<label>` + (label ? label : name + `:`) + (br ? `<br>` : ` `)
        ) +
        `<` + type + (id ? ` id="` + (prefix ? prefix + `_` : ``) + id + `"` : ``) + settings + `>` +
        inside +
        closer + (nolabel ? `` : `</label>`)
    );
};
function bracketsplit(string, starts, ends) {
// splits a string into words and sets of brackets.
// - as in, if the start and end characters are "[" and "]", a set of []
//   with multiple words inside it will be counted as a single word.
    let i1 = 0;
    let i2 = 0;
    if(typeof starts === "string") {
        starts = [starts];
    };
    if(typeof ends === "string") {
        ends = [ends];
    };
    if(starts.length !== ends.length) {
        console.log("the number of starts and ends must match.");
        return;
    };
    //string = trimspecial(string, " ");
    let brackets = [];
    // array of indexes where brackets begin and end. (works like
    // quote.ranges.)
    let levels = [];
    // starts/ends indexes. length also serves as the number of levels in it
    // is.
    let closechar = () => levels.length ? ends[levels[levels.length - 1]] : null;
    let total = 0;
    // number of characters elapsed at the start of the current block.
    let code = function(string, inquotes) {
        if(!inquotes) {
            let i1 = 0;
            let i2 = 0;
            for(i1 = 0; i1 < string.length; i1++) {
                if(string.slice(i1).startsWith(closechar())) {
                    // close brackets
                    i1 += closechar().length - 1;
                    // next iteration will be after the bracket
                    if(levels.length === 1) {
                        brackets[brackets.length] = total + i1 + 1;
                    }
                    levels.splice(levels.length - 1, 1);
                }
                else {
                    for(i2 = 0; i2 < starts.length; i2++) {
                        if(string.slice(i1).startsWith(starts[i2])) {
                            // open bracket
                            levels[levels.length] = i2;
                            if(levels.length === 1) {
                                brackets[brackets.length] = total + i1;
                            }
                            i1 += starts[i2].length - 1;
                            // next iteration is after the bracket
                            i2 += starts.length;
                            // exit loop
                        }
                    }
                }
            }
        };
        total += string.length;
    }
    string = quote.edit(string, null, code);
    let words = [];
    for(i1 = 0; i1 <= brackets.length; i1++) {
        let slice = string.slice(
            i1 === 0 ? 0 : brackets[i1 - 1],
            i1 === brackets.length ? string.length : brackets[i1]
        );
        if(i1%2) {
        // set of brackets
            words[words.length] = trimspecial(slice, " ");
        }
        else {
        // set of words
            words = words.concat(trimspecial(slice));
        }
    }
    return words;
};
function wobblytext(text) {
// makes text look weird through random capitalization. the rules are: it
// cannot stay in the same case for more than 2 letters, and if there's two of
// the same letter consecutively, both of them are put in different cases.
	let i1 = 0;
	let i2 = 0;
	let i3 = 0;
	let indexes = [];
	// indexes of the start and end of each word. ("word" in this case
	// means "sequence of characters that can be made
	// lowercase/uppercase".)
	for(i1 = 0; i1 < text.length; i1++) {
		if(!!(indexes.length%2) === (text[i1].toLowerCase() === text[i1].toUpperCase())) {
			indexes[indexes.length] = i1;
		}
	}
	if(indexes.length%2) {
		indexes[indexes.length] = text.length;
	};
	function randomplacement(length) {
	// returns random indexes spaced by 1 or 2.
		let temp = [];
		// for now, it's a random combination of 1s and 2s
		let sum = 0;
		for(; sum < length - 1;) {
			temp[temp.length] = Math.random() < .5 ? 1 : 2;
			sum += temp[temp.length - 1];
		}
		if(sum === length - 1) {
		// if there's only 1 left over, it has to be filled by a 1,
		// but it should be random whether it's put at the beginning
		// or end.
			if(Math.random() < .5) {
				temp.splice(0, 0, 1);
			}
			else {
				temp[temp.length] = 1;
			}
		}
		temp.splice(temp.length - 1, 1);
		// get rid of the last one, since this is gonna be converted
		// from segment lengths to indexes of where they begin/end
		for(let i1 = 1; i1 < temp.length; i1++) {
			temp[i1] += temp[i1 - 1];
		}
		return temp;
	}
	text = text.toLowerCase();
	for(i1 = 0; i1 < indexes.length; i1 += 2) {
	// for every word...
		let start = indexes[i1];
		let length = indexes[i1 + 1] - start;
		let breaks = [];
		for(i2 = 0; i2 < length - 1; i2++) {
		// add changes at repeat characters
			if(
				text[start + i2] === text[start + i2 + 1]
				&&
				(
					i2 + 2 >= length
					||
					text[start + i2] !== text[start + i2 + 2]
				)
				// only do this for letters that repeat
				// twice. anything more can be better covered
				// by the 1 2 rule.
			) {
				breaks[breaks.length] = i2 + 1;
			};
		}
		let changes = [];
		for(i2 = 0; i2 <= breaks.length; i2++) {
			let _start = i2 ? breaks[i2 - 1] : 0;
			let _length = (
				i2 === breaks.length
				? length : breaks[i2]
			) - _start;
			let temp = randomplacement(_length);
			for(i3 = 0; i3 < temp.length; i3++) {
				temp[i3] += _start;
			}
			changes = changes.concat(temp);
			if(i2 < breaks.length) {
				changes[changes.length] = breaks[i2];
			}
		}
		// now changes is an array of where in the word it should
		// switch cases
		let word = text.slice(start, start + length);
		let caps = Math.random() < .5;
		for(i2 = 0; i2 <= changes.length; i2++) {
			let _start = i2 ? changes[i2 - 1] : 0;
			let _end = i2 === changes.length ? length : changes[i2];
			if(caps) {
				word = (
					word.slice(0, _start)
					+
					word.slice(_start, _end).toUpperCase()
					+
					word.slice(_end)
				);
			}
			caps = !caps;
		}
		text = text.slice(0, start) + word + text.slice(start + length);
	}
	return text;
}
function readtext(file, code) {
// converts a text file or array of files into text, then runs your function on
// it.
    if(Array.isArray(file)) {
        let index = -1;
        let text = [];
        function readnext(result) {
            if(result) {
                text[index] = result;
            }
            index++;
            if(index < file.length) {
                readtext(file[index], readnext);
            }
            else {
                code(text);
            };
        }
        readnext();
        return;
    };
    let reader = new FileReader();
    reader.onload = function() {
        code(reader.result);
    };
    reader.readAsText(file);
};

function js_to_gd(code) {
// something simple that converts some of javascript syntax to gdscript. still
// needs to be looked over and rewritten, but it gets rid of a lot of busywork.
	code = code.split("\n");
	for(let i1 = 0; i1 < code.length; i1++) {
		let line = code[i1].trimEnd();
		let start = line.slice(0, line.length - line.trimStart().length)
		if(line.endsWith(";")) {
			line = line.slice(0, -1);
            code[i1] = line;
		};
		if(line.endsWith("}")) {
			if(line.trim().length === 1) {
				code.splice(i1, 1);
				i1--;
			}
			else {
				line = line.slice(0, -1);
                code[i1] = line;
			}
		}
		else if(line.endsWith("{")) {
			line = line.slice(0, -1).trimEnd() + ":";
            code[i1] = line;
		}
		else if(line.trimStart().startsWith("let ")) {
			line = start + "var " + line.trimStart().slice(4);
            code[i1] = line;
		};
		for(let i2 = 0; i2 < 5; i2++) {
			let temp = "var i" + i2 + " ="
			if(line.trimStart().startsWith(temp)) {
				code.splice(i1, 1);
				i1--;
                i2 += 5;
			}
			else if (line.trimStart().startsWith("for")) {
				let _line = line.trimStart().slice(3).trimStart().replace("(let ", "(");
				temp = ["(i" + i2 + " = 0; i" + i2 + " < ", "; i" + i2 + "++):"];
				if(_line.startsWith(temp[0]) && _line.endsWith(temp[1])) {
                    line = start + "for i" + i2 + " in " + _line.slice(temp[0].length, -temp[1].length).trim() + ":";
                    code[i1] = line;
                    i2 += 5;
                }
			}
		}
	}
	code = code.join("\n").replaceAll("===", "==").replaceAll("!==", "!=").replaceAll("else if", "elif").replaceAll("//", "#").replaceAll("Math.", "").replaceAll("&&", "and").replaceAll("||", "or").replaceAll("console.log", "print_debug");
    let wordstart = null;
    let startslower = false;
    let hasupper = false;
    for(let i1 = 0; i1 <= code.length; i1++) {
    // convert pascal case to snake case
        if(i1 === code.length || code[i1].toLowerCase() === code[i1].toUpperCase()) {
            if(wordstart !== null && startslower && hasupper) {
                let oldword = code.slice(wordstart, i1);
                let newword = "";
                for(let i2 = wordstart; i2 < i1; i2++) {
                    if(code[i2] === code[i2].toUpperCase()) {
                        newword += "_";
                    };
                    newword += code[i2].toLowerCase();
                }
                code = code.slice(0, wordstart) + newword + code.slice(i1);
                i1 = wordstart + newword.length;
            }
            wordstart = null;
            startslower = false;
            hasupper = false;
        }
        else {
            if(wordstart === null) {
                wordstart = i1;
                startslower = code[i1] === code[i1].toLowerCase();
            }
            hasupper = hasupper || code[i1] === code[i1].toUpperCase();
        }
    }
    return code;
}

function block_ranges(string, escaped, starts, ends, noquotefix) {
// returns an array of indexes for where quotes, brackets, or whatever
// you want start and end. (not counting quotes/brackets within
// quotes/brackets.)
// - basically, better logic than quote.ranges and bracketsplit. i could've made
//   both of those with this. ...don't feel like incorporating them though.
//   - considering what i've been doing with godot, at least rewriting and
//     optimizing gives me something to do when porting. except i already
//     ported both of those
// - escaped: quotes are negated if there's a backslash before them. a double
//   backslash, that is. use this for strings that are allowed to use escaped
//   characters, like code, JSON.stringify, etc.
// - noquotefix: for the most part, quotes can be treated like any other set of
//   brackets, but the one problem that can cause is that if you open brackets
//   inside a quote, the quote cannot close until those brackets close. it fixes
//   that by allowing the innermost quote to close at any time.
    const quotes = `'"\``;
    if(typeof starts === "string") {
        starts = starts.split("");
    }
    else if(!Array.isArray(starts)) {
        starts = quotes.split("");
    };
    if(typeof ends === "string") {
        ends = ends.split("");
    }
    else if(!Array.isArray(ends)) {
        ends = quotes.split("");
    };
    let ranges = [];
    // indexes where things open/close
    let levels = [];
    // indexes of starts/ends for what kind of block it is
    let lastquote = -1;
    // the ranges and levels indexes for the latest quote opening.
    let isquote = (index) => quotes.includes(starts[index]) && quotes.includes(ends[index]);
    for(let i1 = 0; i1 < string.length; i1++) {
        let skip = false;
        let escapedchar = string.slice(0, i1).endsWith("\\")
        let right = string.slice(i1);
        if(levels.length) {
            let skipquotecheck = lastquote === -1 || lastquote === levels.length - 1 || noquotefix;
            for(let i2 = 0; i2 < (skip ? 0 : skipquotecheck ? 1 : 2); i2++) {
            // allow the most recent block start to end, or the most recent
            // quote.
                let level = i2 ? lastquote : levels.length - 1;
                let closer = ends[ levels[level] ];
                if(
                    right.startsWith(closer)
                    &&
                    (!escaped || !escapedchar || !quotes.includes(closer))
                ) {
                // go down a level
                    //console.log("close: " + i1);
                    levels = levels.slice(0, level);
                    if(isquote(i2)) {
                    // reevaluate lastquote now that the lastquote has closed
                        lastquote = levels.findLastIndex( (element) => isquote(element) ) ?? -1;
                    }
                    //console.log(levels.join(""));
                    i1 += closer.length;
                    if(!levels.length) {
                        ranges[ranges.length] = i1;
                    }
                    i1--;
                    skip = true;
                    // if it was already a closer, it can't be an opener.
                }
            }
        };
        for(let i2 = 0; !skip && i2 < starts.length; i2++) {
            let opener = starts[i2]
            if(
                right.startsWith(opener)
                &&
                (!escaped || !escapedchar || !quotes.includes(opener))
            ) {
                //console.log("open: " + i1);
                if(!levels.length) {
                    ranges[ranges.length] = i1;
                }
                levels[levels.length] = i2;
                if(isquote(i2)) {
                    lastquote = levels.length - 1;
                };
                //console.log(levels.join(""));
                i1 += opener.length - 1;
            };
        }
    }
    return ranges;
}
let string_block = (string, block_ranges, block) => (
    (block >= 0 && block <= block_ranges.length)
    ?
    string.slice(
        block ? block_ranges[block - 1] : 0,
        block < block_ranges.length ? block_ranges[block] : string.length
    )
    :
    null
);
function trimunspecial(string) {
// used in things like Bullets. trimspecial, except quoted text isn't an
// exception.
// - useful for text that isn't code. trimspecial can mistake apostrophes for
//   quotes if it's used wrong.
    string = string.trim();
    let _string = "";
    for(let i1 = 0; i1 < string.length; i1++) {
        if(string[i1].trim()) {
            _string += string[i1];
        }
        else if(!_string.endsWith(" ")) {
            _string += " ";
        }
    }
    return _string;
}
function arraytoul(array, indent) {
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
function unmedia(string) {
// removes a quirk of my personal notes.
// - i namedrop everything with #, &, or % parentheses.
    let ranges = block_ranges(string, false, "(", ")");
    let _string = "";
    let bool = false;
    // if the namedrop comes at the end, or there's nothing but parenthesed
    // phrases after it, keep it in parentheses, just remove the symbol.
    for(let i1 = ranges.length; i1 >= 0; i1--) {
        let block = string_block(string, ranges, i1);
        if(i1%2) {
            if(block.length >= 3 && "#&%".includes(block[1])) {
            // media
                if(bool || !_string) {
                // it's okay to simplify it
                    let temp = block.slice(2, -1).split(",");
                    block = "";
                    for(let i2 = 0; i2 < temp.length; i2++) {
                        if(i2) {
                            block += i2 === temp.length - 1 ? ", and " : ", ";
                        }
                        block += temp[i2].slice(temp[i2].indexOf(":") + 1).trim();
                    }
                }
                else {
                    block = "(" + block.slice(2, -1).trim() + ")";
                }
            }
        }
        else if(!bool && block.trim()) {
        // only flip it on if there's actual unparenthesed words. it doesn't
        // count if it's immediately before a parenthesed phrase with no
        // whitespace.
            let temp = block.trimStart();
            bool = i1 === ranges.length;
            for(let i2 = 0; i2 < temp.length && !bool; i2++) {
                bool = !temp[i2].trim();
            }
        }
        _string = block + _string;
    }
    return _string;
}
function simplify(string) {
// simplifies a string for the sake of comparison.
// - toLowerCase()
// - trimunspecial
// - remove parenthesed content
// - remove punctuation at the end
    let _string = trimunspecial(string.toLowerCase());
    let ranges = block_ranges(_string, false, "(", ")");
    string = "";
    for(let i1 = 0; i1 <= ranges.length; i1 += 2) {
        string += (string ? " " : "") + string_block(_string, ranges, i1);
    }
    while(string.endsWith(".") || string.endsWith("!") || string.endsWith("?")) {
        string = string.slice(0, -1);
    };
    return string;
}
