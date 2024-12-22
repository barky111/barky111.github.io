const offline = false;
const offline_url = "file:///C:/My Stuff/programming";
// edit these to create an online/offline version.
const info = {
// important text info used in automatic rss creation and stuff.
    url: (offline ? offline_url : "https://barky111.github.io"),
    site_name: "barky's web tool repository",
    user_name: "barky",
    language: "en-us",
    icon: "",
    // url for an image
};

const head = `<head>
    <meta charset="UTF-8" name="viewport" content="width=device-width, initial-scale=1.0">
    <title>` + info.site_name + `</title>
    <link href="script/style.css" rel="stylesheet" type="text/css" media="all"/>
</head>`;
const header = `<header>
    <h1><a href="` + info.url + `">` + info.site_name + `</a></h1>
    <nav>
        ` + [
            `<a href="texttools.html">text tools</a>`,
            `<a href="canvastools.html">canvas tools</a>`,
            `<a href="misctools.html">misc tools</a>`
        ].join(" " + String.fromCharCode(8226) + " ") + `
    </nav>
</header>`;
const footer = `<footer>
    <a href="mailto:barky11111@gmail.com">contact</a>
</footer>`;
