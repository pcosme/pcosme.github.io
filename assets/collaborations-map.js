/* Interactive academic collaborators map: Robinson world + Mercator Europe inset.
   Source locations: assets/collaborations.json. World outlines: Natural Earth
   via world-atlas TopoJSON (loaded from jsDelivr when disclosure is opened). */
(() => {
  "use strict";
  const disclosure = document.getElementById("collaborations");
  const mount = document.getElementById("collaborations-map");
  if (!disclosure || !mount) return;

  const VIEW_W = 1120;
  const VIEW_H = 650;
  const FRAME = { x: 50, y: 296, w: 585, h: 318 };
  const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
  let loaded = false;
  let requested = false;
  let pinned = null;
  let active = null;
  let latest = null;
  let stage;
  let svg;
  let tooltip;

  function appendText(parent, tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = content;
    parent.appendChild(node);
    return node;
  }

  function setActive(id) {
    active = id;
    if (!stage) return;
    stage.querySelectorAll(".collab-marker").forEach((marker) => {
      marker.classList.toggle("is-active", marker.dataset.locationId === id);
    });
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
    latest = null;
    setActive(null);
  }

  function showTooltip(location, point) {
    if (!tooltip || !svg) return;
    tooltip.replaceChildren();
    appendText(tooltip, "h3", "", location.city);
    appendText(tooltip, "p", "collab-count",
      location.people.length + (location.people.length === 1 ? " coauthor" : " coauthors"));
    const names = document.createElement("ul");
    for (const person of location.people) {
      const item = document.createElement("li");
      appendText(item, "span", "", person.name);
      if (person.affiliation) appendText(item, "small", "", person.affiliation);
      names.appendChild(item);
    }
    tooltip.appendChild(names);
    tooltip.hidden = false;
    setActive(location.id);
    latest = { location, point };
    positionTooltip(point);
  }

  function positionTooltip(point) {
    if (!tooltip || tooltip.hidden || !svg) return;
    const scale = svg.getBoundingClientRect().width / VIEW_W;
    const x = point[0] * scale;
    const y = point[1] * scale;
    const stageW = stage.clientWidth;
    const stageH = svg.getBoundingClientRect().height;
    const cardW = tooltip.offsetWidth;
    const cardH = tooltip.offsetHeight;
    let left = x + 20 * scale;
    let top = y - 12 * scale;
    if (left + cardW > stageW - 12) left = x - cardW - 20 * scale;
    if (top + cardH > stageH - 12) top = y - cardH - 20 * scale;
    tooltip.style.left = Math.max(12, Math.min(left, stageW - cardW - 12)) + "px";
    tooltip.style.top = Math.max(12, top) + "px";
  }

  function addMarker(group, location, position, radius, origin) {
    if (!position || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return;
    const d3 = window.d3;
    if (origin && (origin[0] !== position[0] || origin[1] !== position[1])) {
      group.append("line").attr("class", "collab-leader")
        .attr("x1", origin[0]).attr("y1", origin[1])
        .attr("x2", position[0]).attr("y2", position[1]);
      group.append("circle").attr("class", "collab-anchor")
        .attr("cx", origin[0]).attr("cy", origin[1]).attr("r", 2.8);
    }
    const marker = group.append("g").attr("class", "collab-marker")
      .attr("transform", "translate(" + position[0] + "," + position[1] + ")")
      .attr("data-location-id", location.id)
      .attr("role", "button").attr("tabindex", "0")
      .attr("aria-label", location.city + ", " + location.people.length + " coauthors");
    marker.append("circle").attr("class", "collab-visible").attr("r", radius);
    marker.append("circle").attr("class", "collab-hit")
      .attr("r", Math.max(radius + 10, 21));
    marker.on("pointerenter", (event) => {
      if (event.pointerType === "touch" || pinned) return;
      showTooltip(location, position);
    }).on("pointerleave", () => {
      if (!pinned) hideTooltip();
    }).on("focus", () => {
      if (!pinned) showTooltip(location, position);
    }).on("blur", () => {
      if (!pinned) hideTooltip();
    }).on("click", (event) => {
      event.stopPropagation();
      if (pinned === location.id) {
        pinned = null;
        hideTooltip();
      } else {
        pinned = location.id;
        showTooltip(location, position);
      }
    }).on("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        marker.dispatch("click", { bubbles: true });
      }
    });
  }

  function draw(data, topology) {
    const d3 = window.d3;
    const topojson = window.topojson;
    if (!d3 || !d3.geoRobinson || !topojson) {
      throw new Error("Mapping libraries unavailable");
    }
    mount.replaceChildren();
    const viewport = document.createElement("div");
    viewport.className = "collaborations-viewport";
    stage = document.createElement("div");
    stage.className = "collaborations-stage";
    viewport.appendChild(stage);
    mount.appendChild(viewport);

    svg = stage && d3.select(stage).append("svg")
      .attr("class", "collaborations-svg")
      .attr("viewBox", "0 0 " + VIEW_W + " " + VIEW_H)
      .attr("role", "group")
      .attr("aria-label", "Interactive world map of academic coauthors with a Europe inset")
      .node();
    const canvas = d3.select(svg);
    canvas.append("title").text("Academic collaborators around the world");
    canvas.append("desc").text("Bubble area is proportional to the number of coauthors at each location. Hover, focus, or select a bubble to explore names.");

    tooltip = document.createElement("div");
    tooltip.className = "collab-tooltip";
    tooltip.hidden = true;
    tooltip.setAttribute("role", "status");
    tooltip.setAttribute("aria-live", "polite");
    stage.appendChild(tooltip);

    const worldProjection = d3.geoRobinson().rotate([-10, 0])
      .fitExtent([[24, 32], [1096, 600]], { type: "Sphere" });
    const worldPath = d3.geoPath(worldProjection);
    const countries = topojson.feature(topology, topology.objects.countries);
    const land = topojson.feature(topology, topology.objects.land);
    const borders = topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b);
    const graticule = d3.geoGraticule().step([30, 30])();

    const base = canvas.append("g").attr("aria-hidden", "true");
    base.append("path").datum({ type: "Sphere" }).attr("class", "collab-sphere").attr("d", worldPath);
    base.append("path").datum(graticule).attr("class", "collab-graticule").attr("d", worldPath);
    base.append("path").datum(land).attr("class", "collab-land").attr("d", worldPath);
    base.append("path").datum(borders).attr("class", "collab-borders").attr("d", worldPath);

    const worldMarkers = canvas.append("g").attr("aria-label", "World locations");
    for (const loc of data.locations) {
      addMarker(worldMarkers, loc, worldProjection([loc.lon, loc.lat]),
        9.3 * Math.sqrt(loc.people.length), null);
    }

    // The inset intentionally overlays part of the world map and does not
    // duplicate the world markers' data counts.
    const inset = canvas.append("g");
    const defs = canvas.append("defs");
    defs.append("clipPath").attr("id", "collab-europe-clip")
      .append("rect").attr("x", FRAME.x + 1).attr("y", FRAME.y + 1)
      .attr("width", FRAME.w - 2).attr("height", FRAME.h - 2)
      .attr("rx", 15);
    inset.append("rect").attr("class", "collab-inset-bg")
      .attr("x", FRAME.x).attr("y", FRAME.y)
      .attr("width", FRAME.w).attr("height", FRAME.h).attr("rx", 15);

    const europeProjection = d3.geoMercator().center([0.5, 48.1]).scale(475)
      .translate([FRAME.x + FRAME.w / 2, FRAME.y + FRAME.h / 2]);
    const euroPath = d3.geoPath(europeProjection);
    const geoInset = inset.append("g").attr("clip-path", "url(#collab-europe-clip)")
      .attr("aria-hidden", "true");
    geoInset.append("path").datum(graticule).attr("class", "collab-inset-graticule").attr("d", euroPath);
    geoInset.append("path").datum(land).attr("class", "collab-inset-land").attr("d", euroPath);
    geoInset.append("path").datum(borders).attr("class", "collab-inset-borders").attr("d", euroPath);
    const europeMarkers = inset.append("g").attr("aria-label", "European locations");
    for (const loc of data.locations) {
      if (loc.id === "bangkok") continue;
      const origin = europeProjection([loc.lon, loc.lat]);
      const offset = loc.insetOffset || [0, 0];
      const target = [origin[0] + offset[0], origin[1] + offset[1]];
      addMarker(europeMarkers, loc, target,
        10 * Math.sqrt(loc.people.length), origin);
    }

    canvas.on("click", () => {
      pinned = null;
      hideTooltip();
    });
    document.addEventListener("pointerdown", (event) => {
      if (pinned && !stage.contains(event.target)) {
        pinned = null;
        hideTooltip();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        pinned = null;
        hideTooltip();
      }
    });
    window.addEventListener("resize", () => {
      if (latest) positionTooltip(latest.point);
    });
    loaded = true;
  }

  async function loadMap() {
    if (loaded || requested) return;
    requested = true;
    mount.innerHTML = '<p class="collaborations-loading">Loading map…</p>';
    try {
      const [dataResponse, mapResponse] = await Promise.all([
        fetch("assets/collaborations.json"),
        fetch(ATLAS_URL)
      ]);
      if (!dataResponse.ok || !mapResponse.ok) throw new Error("Map data unavailable");
      const [data, topology] = await Promise.all([dataResponse.json(), mapResponse.json()]);
      if (!Array.isArray(data.locations) || !topology.objects?.countries || !topology.objects?.land) {
        throw new Error("Invalid map data");
      }
      draw(data, topology);
    } catch (error) {
      mount.innerHTML = '<p class="collaborations-error">The interactive map could not be loaded. Please try again later.</p>';
      requested = false;
      console.error("Collaborations map:", error);
    }
  }

  disclosure.addEventListener("toggle", () => {
    if (disclosure.open) {
      loadMap();
    } else {
      pinned = null;
      hideTooltip();
    }
  });
  if (disclosure.open) loadMap();
})();
