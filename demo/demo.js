/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const positions = ["start", "end", "center"];

const randomInt = (max) => {
  return Math.floor(Math.random() * max);
};

const randomColor = () => {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
};

// @ref: https://stackoverflow.com/a/35970186/2076595
const invertColor = (hex) => {
  if (hex.indexOf("#") === 0) {
    hex = hex.slice(1);
  }
  // convert 3-digit hex to 6-digits.
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    throw new Error("Invalid HEX color.");
  }
  var r = parseInt(hex.slice(0, 2), 16),
    g = parseInt(hex.slice(2, 4), 16),
    b = parseInt(hex.slice(4, 6), 16);

  // invert color components
  r = (255 - r).toString(16);
  g = (255 - g).toString(16);
  b = (255 - b).toString(16);
  // pad each with zeros and return
  return "#" + r.padStart(2, "0") + g.padStart(2, "0") + b.padStart(2, "0");
};

const randomString = (length) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const mutate = () => {
  const curAlignContent = document.body.style.alignContent,
    curJustifyContent = document.body.style.justifyContent;
  let newAlignContent, newJustifyContent;
  do {
    newAlignContent = positions[randomInt(3)];
    newJustifyContent = positions[randomInt(3)];
  } while (
    newAlignContent === curAlignContent &&
    newJustifyContent === curJustifyContent
  );
  document.body.style.alignContent = newAlignContent;
  document.body.style.justifyContent = newJustifyContent;

  // document.querySelector('.box').style.aspectRatio = 1 + getRandomInt(2);
  // document.querySelector('.box').style.borderRadius = `${getRandomInt(50)}px`;
  document.querySelector(".box").style.width = `${randomInt(40)}vmin`;
  const clr = randomColor();
  document.querySelector(".box").style.backgroundColor = clr;
  document.querySelector(".box").style.color = invertColor(clr);
  document.querySelector(".box span").innerText = randomString(randomInt(250));
};

document.body.addEventListener("click", async (e) => {
  // If the click is inside the #controls element, don't trigger a transition.
  if (e.composedPath().includes(document.getElementById("controls"))) {
    return;
  }
  
  console.log("=== startViewTransition");
  const t = document.startViewTransition(mutate);
  // t.skipTransition();

  console.log(document.activeViewTransition);

  t.updateCallbackDone
    .then(() => {
      console.log("=== updateCallbackDone");
      console.log(document.activeViewTransition);
    })
    .catch((e) => {
      console.log("updateCallbackDone ERROR");
    });

  t.ready
    .then(() => {
      console.log("=== ready");
      console.log(document.activeViewTransition);
    })
    .catch((e) => {
      console.log("ready ERROR");
    });

  t.finished
    .then(() => {
      console.log("=== finished");
      console.log(document.activeViewTransition);
    })
    .catch((e) => {
      console.log("finished ERROR");
    });
});
