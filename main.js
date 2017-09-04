// This contains the list of data read from the manifest.
let gData = [];

// The selected position from gData.
let gPosition;

// X/Y of the markers on a zone.
let gMarkers = [];

// The current image shown on the canvas.
let gCurrentImage;

// Let's fetch the IIIF manifest from the vaticana website.
fetch("http://digi.vatlib.it/iiif/MSS_Barb.lat.4076/manifest.json")
.then(r => {
  // Download completed. The manifest is a JSON document. Let's parse it.
  return r.json();
})
.then(manifest => {
  // manifest is a JS object, it must contain a |sequences| property.
  if (!("sequences" in manifest)) {
    throw "No sequences in the manifest!"
  }

  // |sequences| cannot be empty.
  if (manifest.sequences.length == 0) {
    throw "Manifest sequences is empty.";
  }

  // The first element of the sequences must contain a |canvases| property.
  if (!("canvases" in manifest.sequences[0])) {
    throw "No canvases in the manifest sequences"
  }

  // For each canvas, I want to get some data and store them in the gData array.
  manifest.sequences[0].canvases.forEach(canvas => {
    try {
      gData.push({
        id: canvas["@id"],
        width: canvas["width"],
        height: canvas["height"],
        thumbnail: canvas["thumbnail"]["@id"],
        image: canvas["images"][0]["resource"]["service"]["@id"],
        label: canvas["label"]
      });
    } catch(e) {
      throw "Error retrieving data from the manifest."
    }
  });
})
.then(() => {
  let currentRow;

  // Populate the choosePage grid.
  gData.forEach((data, position) => {
    if (!(position % 4)) {
      currentRow = $("<div>", {class: "row justify-content-md-center" });
      $("#choosePage").append(currentRow);
    }

    let imageBox = $("<div>", {class: "col, card",
                               onclick: "pageSelected(" + position + ")"});
    currentRow.append(imageBox);

    let image = $("<img>", {class: "card-img-top", src: data.thumbnail});
    imageBox.append(image);

    let labelBox = $("<div>", {class: "card-block" })
    imageBox.append(labelBox);

    let label = $("<p>", {class: "card-title"})
    label.text(data.label);
    labelBox.append(label);
  });
})
.then(() => {
  // We have all we need to enable the TEI generator.
  // We have to enable the starting button, and write something in it.
  $("#startingButton").removeClass("disabled");
  $("#startingButton").text($("#startingButton").attr("data-ready"));
})
.catch(error => {
  // If something went wrong, we are here. Let's show a proper message.
  let div = $("<div>", {class: "alert alert-danger", role: "alert"});
  div.append("<strong>Oh sorry!</strong> " + error);
  $("body").append(div);
});

// This function hides all the pages (div with class 'page') and shows the page
// with the specified name.
function nextPage(pageName) {
  $(".page").hide();
  $("#" + pageName).show();
}

// This function is called when the user clicks on an image from the second
// page.
function pageSelected(position) {
  // Let's show the following page.
  nextPage("zonePage");

  gPosition = position;
  let data = gData[gPosition];

  let canvas = document.getElementById("bigImage");
  canvas.height = $(canvas).height();
  canvas.width = $(canvas).width();

  // Create new img element
  gCurrentImage = new Image();
  gCurrentImage.addEventListener("load", function() {
    // The image has been loaded. We can show it.
    zoneReset();
  }, false);
  gCurrentImage.src = data.image + "/full/" + canvas.width + ",/0/default.jpg";
}

// This function is called when the canvas is clicked. We use it for storing
// X/Y of the click and draw a marker.
function zoneClick(event) {
  gMarkers.push({x: event.offsetX, y: event.offsetY});
  zoneShowMarker(event.offsetX, event.offsetY);
}

// This function shows a single marker in position x/y.
function zoneShowMarker(x, y) {
  let circle = new Path2D();
  circle.moveTo(x, y);
  circle.arc(x, y, 6, 0, 2 * Math.PI);

  let canvas = document.getElementById("bigImage");
  let ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.fill(circle);
}

// This method resets the canvas, removing all the markers.
function zoneReset() {
  gMarkers = [];

  let canvas = document.getElementById("bigImage");
  let ctx = canvas.getContext("2d");
  ctx.drawImage(gCurrentImage, 0, 0, gCurrentImage.width, gCurrentImage.height);
}

// This zone shows the image + the markers + an area generated by the
// unification of the markers.
function zoneUnify() {
  if (gMarkers.length == 0) {
    return;
  }

  let canvas = document.getElementById("bigImage");
  let ctx = canvas.getContext("2d");
  ctx.drawImage(gCurrentImage, 0, 0, gCurrentImage.width, gCurrentImage.height);

  // The markers.
  gMarkers.forEach(marker => {
    zoneShowMarker(marker.x, marker.y);
  });

  // The path.
  ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
  ctx.beginPath();

  // Let's move to the first marker.
  ctx.moveTo(gMarkers[0].x, gMarkers[0].y);

  // for any following marker...
  for (let i = 1; i < gMarkers.length; ++i) {
    ctx.lineTo(gMarkers[i].x, gMarkers[i].y);
  }

  // Let's draw.
  ctx.fill();
}

function zoneDone() {
  if (gMarkers.length == 0) {
    alert("Non hai selezionato nessuna zona.");
    return;
  }

  nextPage("formPage");
}

function teiGenerator() {
  nextPage("teiPage");

  let fileName = teiGeneratorFileName();

  fetch("template.xml")
  .then(response => {
    return response.text();
  })
  .then(text => {
    let data = gData[gPosition];

    // Let's replace the image URL.
    text = text.replace("TEMPLATE_IMAGE_URL", data.image + "/full/full/0/default.jpg");

    // here the points.
    let points = gMarkers.map(marker => marker.x + "," + marker.y).join(" ")
    text = text.replace("TEMPLATE_IMAGE_POINTS", points);

    // type.
    text = text.replace("TEMPLATE_TYPE", $("#formType").val());

    return text;
  })
  .then(tei => {
    // Let's create a blob containing the TEI document.
    let blob = new Blob([tei], {type: "octet/stream"});

    // From the blob, we can create a URL.
    let url = URL.createObjectURL(blob);

    // In order to start the downloading, we need an <a> element.
    let a = $("<a>", {class: "hidden", href: url, download: fileName });
    $("body").append(a);

    // Let's simulate the click.
    a[0].click();
  });
}

function teiGeneratorFileName() {
  return "foo.xml";
}
