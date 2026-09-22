(function ($) {
  "use strict";

  var STORAGE_KEY = "mandala-chart-state-v2";
  var LEGACY_STORAGE_KEY = "mandala-chart-state-v1";
  var THEME_KEY = "mandala-chart-theme-v1";

  var state = loadState();
  var selectedId = state.rootId || null;
  var editingId = null;
  var selectedDetailId = null;
  var suggestionBuffer = [];
  var currentNextId = null;
  var toastTimer = null;
  var promptTimer = null;
  var promptIndex = 0;
  var initialRender = true;

  var camera = { x: 0, y: 0, scale: 1 };
  var panState = null;
  var nodeDragState = null;
  var pointers = {};
  var pinchState = null;
  var renderPositions = {};

  var PROMPTS = [
    "What do you want to finish?",
    "What do you want to achieve?",
    "What is your goal?",
    "What needs to get done?",
    "What would make today count?"
  ];

  var LABELS = {
    0: "GOAL",
    1: "DRIVER",
    2: "ACTION",
    3: "STEP"
  };

  var DRIVER_SUGGESTIONS = {
    launch: [
      "Product readiness",
      "Offer & positioning",
      "Pricing & payment",
      "Ideal customer",
      "Prospecting",
      "Outreach",
      "Launch content",
      "Measurement"
    ],
    learn: [
      "Clear outcome",
      "Core fundamentals",
      "Practice routine",
      "Learning resources",
      "Feedback loop",
      "Small projects",
      "Consistency",
      "Progress review"
    ],
    read: [
      "Pages remaining",
      "Daily reading target",
      "Reading blocks",
      "Distraction control",
      "Notes & highlights",
      "Catch-up buffer",
      "Environment",
      "Completion check"
    ],
    generic: [
      "Define success",
      "Break down scope",
      "Prepare resources",
      "Schedule the work",
      "Remove blockers",
      "Execute",
      "Measure progress",
      "Review & adjust"
    ]
  };

  var ACTION_SUGGESTIONS = {
    product: [
      "List launch blockers",
      "Test the main user flow",
      "Fix mobile issues",
      "Test error states",
      "Verify output quality",
      "Check performance",
      "Write a short QA checklist",
      "Freeze non-essential features"
    ],
    pricing: [
      "Choose one simple price",
      "Set up payment link",
      "Test successful payment",
      "Test failed payment",
      "Clarify what is included",
      "Add refund / support note",
      "Place pricing CTA",
      "Run one real payment test"
    ],
    customer: [
      "Write ICP in one sentence",
      "Define 3 qualification rules",
      "Find 10 matching prospects",
      "Capture one recent signal each",
      "Remove weak-fit leads",
      "Rank by relevance",
      "Save contact path",
      "Prepare first outreach batch"
    ],
    prospect: [
      "Pick one acquisition channel",
      "Define search criteria",
      "Find 10 qualified prospects",
      "Capture profile links",
      "Add one personalization signal",
      "Rank strongest 5",
      "Prepare examples",
      "Record outreach status"
    ],
    outreach: [
      "Write one short message",
      "Personalize the first line",
      "Send to 5 prospects",
      "Track replies",
      "Follow up after 3 days",
      "Record objections",
      "Test one message variation",
      "Review response rate"
    ],
    marketing: [
      "Choose one target audience",
      "Write one clear promise",
      "Create one proof example",
      "Publish one demo",
      "Reach out to 5 prospects",
      "Post in one relevant community",
      "Track clicks and replies",
      "Review what worked"
    ],
    read: [
      "Count pages remaining",
      "Divide pages by available days",
      "Book a reading block",
      "Put phone away",
      "Read first session",
      "Mark current page",
      "Use one catch-up block",
      "Finish final pages"
    ],
    learn: [
      "Define one concrete skill",
      "Choose one resource",
      "Schedule 20 minutes",
      "Practice one basic exercise",
      "Repeat without notes",
      "Make one tiny project",
      "Get feedback",
      "Review progress"
    ],
    generic: [
      "Define what done means",
      "Identify the first concrete move",
      "Remove one blocker",
      "Reserve a time block",
      "Do the smallest useful version",
      "Check the result",
      "Capture what changed",
      "Choose the next action"
    ]
  };

  $(init);

  function init() {
    applyStoredTheme();
    $("#year").text(new Date().getFullYear());
    bindGlobalEvents();

    if (!$("#mapViewport").length) return;

    bindPlannerEvents();

    if (state.rootId && state.nodes[state.rootId]) {
      selectedId = selectedId || state.rootId;
      normalizeState();
      stopPromptRotation();
      showMap();
      renderAll(false);
      setTimeout(function () {
        fitAll(false);
        initialRender = false;
      }, 40);
    } else {
      showEmptyMap();
      startPromptRotation();
      initialRender = false;
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  }

  function bindGlobalEvents() {
    $("#themeButton").on("click", toggleTheme);
  }

  function bindPlannerEvents() {
    $("#rootStarter").on("click", function (e) {
      if ($(e.target).is("textarea")) return;
      openRootEditor();
    });

    $("#rootStarter").on("keydown", function (e) {
      if (e.key === "Enter" && !$(e.target).is("textarea")) {
        e.preventDefault();
        openRootEditor();
      }
    });

    $("#rootInput").on("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitRoot();
      }
    });

    $("#rootInput").on("blur", function () {
      if ($(this).val().trim()) commitRoot();
    });

    $("#mapNodes").on("click", ".map-node", function (e) {
      if ($(e.target).is("textarea")) return;
      if (nodeDragState && nodeDragState.moved) return;

      var id = $(this).data("id");
      var node = state.nodes[id];
      if (!node) return;

      if (!node.title.trim()) {
        selectedId = id;
        editingId = id;
        renderAll(false);
        focusCameraOnNode(id, 1.05);
        return;
      }

      selectNode(id, true);

      if (node.depth === 1 && !node.children.length) {
        createEightSlots(id);
        renderAll(true);
        focusCameraOnNode(id, .78);
        showToast("Driver opened. Add eight actions around it.");
      }
    });

    $("#mapNodes").on("dblclick", ".map-node", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = $(this).data("id");
      if (!state.nodes[id]) return;
      selectedId = id;
      editingId = id;
      renderAll(false);
    });

    $("#mapNodes").on("keydown", ".node-edit", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitNodeEdit($(this).closest(".map-node").data("id"));
      } else if (e.key === "Escape") {
        e.preventDefault();
        editingId = null;
        renderAll(false);
      }
    });

    $("#mapNodes").on("input", ".node-edit", function () {
      var id = $(this).closest(".map-node").data("id");
      if (!state.nodes[id]) return;
      state.nodes[id].title = $(this).val();
      saveState();
      updateSelectionBar();
    });

    $("#mapNodes").on("blur", ".node-edit", function () {
      commitNodeEdit($(this).closest(".map-node").data("id"));
    });

    $("#mapNodes").on("pointerdown", ".map-node", function (e) {
      if (!e.shiftKey || $(e.target).is("textarea")) return;
      var id = $(this).data("id");
      var node = state.nodes[id];
      if (!node) return;

      e.preventDefault();
      e.stopPropagation();

      nodeDragState = {
        id: id,
        startX: e.clientX,
        startY: e.clientY,
        baseX: (node.offsetX || 0),
        baseY: (node.offsetY || 0),
        moved: false
      };

      try { this.setPointerCapture(e.pointerId); } catch (ignore) {}
    });

    $("#mapNodes").on("pointermove", ".map-node", function (e) {
      if (!nodeDragState || nodeDragState.id !== $(this).data("id")) return;
      var node = state.nodes[nodeDragState.id];
      if (!node) return;

      var dx = (e.clientX - nodeDragState.startX) / camera.scale;
      var dy = (e.clientY - nodeDragState.startY) / camera.scale;

      if (Math.abs(dx) + Math.abs(dy) > 4) nodeDragState.moved = true;

      node.offsetX = nodeDragState.baseX + dx;
      node.offsetY = nodeDragState.baseY + dy;
      renderAll(false);
    });

    $("#mapNodes").on("pointerup pointercancel", ".map-node", function () {
      if (!nodeDragState) return;
      saveState();
      nodeDragState = null;
    });

    $("#mapViewport").on("pointerdown", function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

      if ($(e.target).closest(".map-node, .map-toolbar, .minimap, .empty-map").length) return;

      try { this.setPointerCapture(e.pointerId); } catch (ignore) {}

      if (Object.keys(pointers).length === 1) {
        panState = {
          startX: e.clientX,
          startY: e.clientY,
          cameraX: camera.x,
          cameraY: camera.y
        };
        $(this).addClass("grabbing");
      }

      if (Object.keys(pointers).length === 2) beginPinch();
    });

    $("#mapViewport").on("pointermove", function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

      if (Object.keys(pointers).length === 2) {
        updatePinch();
        return;
      }

      if (!panState) return;

      camera.x = panState.cameraX + (e.clientX - panState.startX);
      camera.y = panState.cameraY + (e.clientY - panState.startY);
      applyCamera();
    });

    $("#mapViewport").on("pointerup pointercancel", function (e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchState = null;
      if (Object.keys(pointers).length === 0) {
        panState = null;
        $(this).removeClass("grabbing");
      }
    });

    $("#mapViewport").on("wheel", function (e) {
      if (!state.rootId) return;
      e.preventDefault();
      var original = e.originalEvent;
      var rect = this.getBoundingClientRect();
      var px = original.clientX - rect.left;
      var py = original.clientY - rect.top;
      var factor = original.deltaY < 0 ? 1.12 : .89;
      zoomAt(px, py, camera.scale * factor);
    });

    $("#zoomInButton").on("click", function () {
      zoomAt(viewportWidth() / 2, viewportHeight() / 2, camera.scale * 1.18);
    });

    $("#zoomOutButton").on("click", function () {
      zoomAt(viewportWidth() / 2, viewportHeight() / 2, camera.scale / 1.18);
    });

    $("#fitButton").on("click", function () { fitAll(true); });
    $("#centerButton, #focusSelectedButton").on("click", function () {
      if (selectedId) focusCameraOnNode(selectedId, Math.max(camera.scale, .85));
    });

    $("#suggestButton").on("click", openSuggestionModal);
    $("#detailsButton, #editSelectedButton").on("click", function () {
      if (selectedId) openInspector(selectedId);
    });

    $("#splitButton").on("click", splitSelected);
    $("#collapseButton").on("click", toggleCollapseSelected);
    $("#nextButton").on("click", openNextModal);
    $("#resetButton").on("click", resetAll);

    $("#markDoneButton").on("click", function () {
      if (!selectedId || !state.nodes[selectedId]) return;
      state.nodes[selectedId].status = state.nodes[selectedId].status === "done" ? "open" : "done";
      saveState();
      renderAll(false);
    });

    $("#selectionBar").on("dblclick", function () {
      if (!selectedId) return;
      editingId = selectedId;
      renderAll(false);
    });

    $("#minimap").on("click", function (e) {
      if (!state.rootId) return;
      var bounds = getWorldBounds();
      if (!bounds) return;
      var rect = this.getBoundingClientRect();
      var rx = (e.clientX - rect.left) / rect.width;
      var ry = (e.clientY - rect.top) / rect.height;
      var wx = bounds.minX + rx * bounds.width;
      var wy = bounds.minY + ry * bounds.height;
      animateCameraTo(
        viewportWidth() / 2 - wx * camera.scale,
        viewportHeight() / 2 - wy * camera.scale,
        camera.scale,
        260
      );
    });

    $("#closeSuggestionModal").on("click", function () {
      $("#suggestionModal").attr("hidden", true);
    });

    $("#shuffleSuggestions").on("click", function () {
      suggestionBuffer = buildSuggestions(state.nodes[selectedId], true);
      renderSuggestions();
    });

    $("#applySuggestions").on("click", applySuggestions);

    $("#closeNextModal").on("click", function () {
      $("#nextModal").attr("hidden", true);
    });

    $("#openNextAction").on("click", function () {
      if (!currentNextId) return;
      $("#nextModal").attr("hidden", true);
      selectNode(currentNextId, true);
      focusCameraOnNode(currentNextId, 1.12);
    });

    $("#completeNextAction").on("click", function () {
      if (!currentNextId || !state.nodes[currentNextId]) return;
      state.nodes[currentNextId].status = "done";
      saveState();
      renderAll(false);
      showToast("Done. Recalculating the next move.");
      openNextModal();
    });

    $("#suggestionModal, #nextModal").on("click", function (e) {
      if (e.target === this) $(this).attr("hidden", true);
    });

    $("#closeInspector").on("click", closeInspector);

    $("#detailTitle").on("input", function () {
      updateSelectedDetail("title", $(this).val());
    });

    $("#impactInput, #effortInput, #urgencyInput").on("input", function () {
      if (!selectedDetailId || !state.nodes[selectedDetailId]) return;
      var node = state.nodes[selectedDetailId];
      node.impact = parseInt($("#impactInput").val(), 10);
      node.effort = parseInt($("#effortInput").val(), 10);
      node.urgency = parseInt($("#urgencyInput").val(), 10);
      $("#impactOutput").text(node.impact);
      $("#effortOutput").text(node.effort);
      $("#urgencyOutput").text(node.urgency);
      updatePriorityCard(node);
      saveState();
    });

    $("#durationInput").on("input", function () {
      updateSelectedDetail("duration", $(this).val());
    });

    $("#statusInput").on("change", function () {
      updateSelectedDetail("status", $(this).val());
      renderAll(false);
    });

    $("#notesInput").on("input", function () {
      updateSelectedDetail("notes", $(this).val());
    });

    $("#deleteNodeButton").on("click", clearSelectedNode);

    $(window).on("resize", debounce(function () {
      renderAll(false);
      if (initialRender) fitAll(false);
    }, 100));

    $(document).on("keydown", function (e) {
      if (e.key === "Escape") {
        closeInspector();
        $("#suggestionModal, #nextModal").attr("hidden", true);
        if (editingId) {
          editingId = null;
          renderAll(false);
        }
      }

      if (!state.rootId) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openNextModal();
      }

      if (!$(e.target).is("textarea,input,select")) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          $("#zoomInButton").trigger("click");
        } else if (e.key === "-") {
          e.preventDefault();
          $("#zoomOutButton").trigger("click");
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          fitAll(true);
        }
      }
    });
  }

  function defaultState() {
    return {
      rootId: null,
      nodes: {},
      version: 2
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return defaultState();

      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.nodes) return defaultState();
      parsed.version = 2;
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function normalizeState() {
    Object.keys(state.nodes).forEach(function (id) {
      var node = state.nodes[id];
      if (!node.children) node.children = [];
      if (typeof node.collapsed !== "boolean") node.collapsed = false;
      if (typeof node.offsetX !== "number") node.offsetX = 0;
      if (typeof node.offsetY !== "number") node.offsetY = 0;
      if (!node.status) node.status = "open";
      if (!node.impact) node.impact = 3;
      if (!node.effort) node.effort = 3;
      if (!node.urgency) node.urgency = 3;
    });
    saveState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return "n_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function createNode(title, parentId, depth) {
    var id = uid();
    state.nodes[id] = {
      id: id,
      title: title || "",
      parentId: parentId || null,
      depth: depth || 0,
      children: [],
      status: "open",
      impact: 3,
      effort: 3,
      urgency: 3,
      duration: "",
      notes: "",
      collapsed: false,
      offsetX: 0,
      offsetY: 0,
      createdAt: Date.now()
    };

    if (parentId && state.nodes[parentId]) {
      state.nodes[parentId].children.push(id);
    }

    return state.nodes[id];
  }

  function createEightSlots(parentId) {
    var parent = state.nodes[parentId];
    if (!parent || parent.children.length) return;

    for (var i = 0; i < 8; i++) {
      createNode("", parentId, parent.depth + 1);
    }

    parent.collapsed = false;
    saveState();
  }

  function showEmptyMap() {
    $("#plannerActions, #selectionBar, #minimap").attr("hidden", true);
    $("#emptyMap").removeAttr("hidden");
    $("#mapNodes, #mapEdges, #minimapWorld").empty();
    $("#rootInput").attr("hidden", true).val("");
    $("#starterCopy").removeAttr("hidden");
    camera = { x: viewportWidth() / 2, y: viewportHeight() / 2, scale: 1 };
    applyCamera();
  }

  function showMap() {
    $("#emptyMap").attr("hidden", true);
    $("#plannerActions, #selectionBar, #minimap").removeAttr("hidden");
  }

  function openRootEditor() {
    stopPromptRotation();
    $("#starterCopy").attr("hidden", true);
    $("#rootInput").removeAttr("hidden").focus();
  }

  function commitRoot() {
    var value = $("#rootInput").val().trim();
    if (!value) {
      $("#rootInput").attr("hidden", true);
      $("#starterCopy").removeAttr("hidden");
      startPromptRotation();
      return;
    }

    state = defaultState();
    var root = createNode(value, null, 0);
    state.rootId = root.id;
    selectedId = root.id;
    createEightSlots(root.id);
    saveState();

    showMap();
    renderAll(true);
    fitAll(true);
    showToast("Goal mapped. Fill the eight driver nodes.");
  }

  function renderAll(animateNew) {
    if (!state.rootId || !state.nodes[state.rootId]) {
      showEmptyMap();
      return;
    }

    showMap();
    normalizeState();

    var visibleIds = getVisibleNodeIds();
    renderPositions = computePositions(visibleIds);

    renderEdges(visibleIds);
    renderNodes(visibleIds, animateNew);
    updateSelectionBar();
    renderMinimap();
    updateCanvasStatus();
    applyCamera();

    if (editingId) {
      setTimeout(function () {
        var $edit = $('.map-node[data-id="' + editingId + '"] .node-edit');
        if ($edit.length) {
          $edit.focus();
          var el = $edit[0];
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 20);
    }
  }

  function getVisibleNodeIds() {
    var result = [];

    function walk(id) {
      var node = state.nodes[id];
      if (!node) return;
      result.push(id);

      if (node.collapsed) return;

      (node.children || []).forEach(function (childId) {
        if (state.nodes[childId]) walk(childId);
      });
    }

    walk(state.rootId);
    return result;
  }

  function computePositions(ids) {
    var positions = {};
    positions[state.rootId] = withOffset(state.nodes[state.rootId], { x: 0, y: 0 });

    ids.forEach(function (id) {
      if (id === state.rootId) return;
      var node = state.nodes[id];
      if (!node) return;

      var path = getIndexPath(id);
      var pos = calculatePositionFromPath(path);
      positions[id] = withOffset(node, pos);
    });

    return positions;
  }

  function getIndexPath(id) {
    var path = [];
    var node = state.nodes[id];

    while (node && node.parentId) {
      var parent = state.nodes[node.parentId];
      if (!parent) break;
      var index = parent.children.indexOf(node.id);
      path.unshift(Math.max(index, 0));
      node = parent;
    }

    return path;
  }

  function calculatePositionFromPath(path) {
    if (!path.length) return { x: 0, y: 0 };

    var rootIndex = path[0] || 0;
    var rootAngle = -Math.PI / 2 + rootIndex * (Math.PI * 2 / 8);

    if (path.length === 1) {
      return polar(360, rootAngle);
    }

    var childIndex = path[1] || 0;
    var sectorStep = deg(5.25);
    var actionAngle = rootAngle + (childIndex - 3.5) * sectorStep;

    if (path.length === 2) {
      return polar(880, actionAngle);
    }

    var parentPos = polar(880, actionAngle);
    var pos = { x: parentPos.x, y: parentPos.y };
    var outward = { x: Math.cos(actionAngle), y: Math.sin(actionAngle) };
    var tangent = { x: -outward.y, y: outward.x };

    for (var depth = 2; depth < path.length; depth++) {
      var idx = path[depth] || 0;
      var forward = 240 + (depth - 2) * 55;
      var spread = 72 - Math.min((depth - 2) * 8, 28);
      var lateral = (idx - 3.5) * spread;

      pos = {
        x: pos.x + outward.x * forward + tangent.x * lateral,
        y: pos.y + outward.y * forward + tangent.y * lateral
      };
    }

    return pos;
  }

  function withOffset(node, pos) {
    return {
      x: pos.x + (node.offsetX || 0),
      y: pos.y + (node.offsetY || 0)
    };
  }

  function polar(radius, angle) {
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  }

  function deg(value) {
    return value * Math.PI / 180;
  }

  function renderEdges(visibleIds) {
    var visible = {};
    visibleIds.forEach(function (id) { visible[id] = true; });

    var html = "";

    visibleIds.forEach(function (id) {
      var node = state.nodes[id];
      if (!node || !node.parentId || !visible[node.parentId]) return;

      var from = renderPositions[node.parentId];
      var to = renderPositions[id];
      if (!from || !to) return;

      var dx = to.x - from.x;
      var dy = to.y - from.y;
      var c1x = from.x + dx * .42;
      var c1y = from.y + dy * .42;
      var c2x = from.x + dx * .72;
      var c2y = from.y + dy * .72;

      html += '<path class="edge-line depth-' + Math.min(node.depth, 3) +
        '" d="M ' + round(from.x) + " " + round(from.y) +
        " C " + round(c1x) + " " + round(c1y) +
        ", " + round(c2x) + " " + round(c2y) +
        ", " + round(to.x) + " " + round(to.y) + '"></path>';
    });

    $("#mapEdges").html(html);
  }

  function renderNodes(visibleIds, animateNew) {
    var html = "";

    visibleIds.forEach(function (id, index) {
      var node = state.nodes[id];
      var pos = renderPositions[id];
      if (!node || !pos) return;

      var placeholder = !node.title.trim();
      var classes = [
        "map-node",
        "depth-" + Math.min(node.depth, 4),
        placeholder ? "placeholder" : "",
        selectedId === id ? "selected" : "",
        node.status === "done" ? "done" : "",
        node.collapsed && node.children.length ? "collapsed" : "",
        animateNew && node.depth > 0 ? "node-enter" : ""
      ].filter(Boolean).join(" ");

      var hiddenCount = countDescendants(id);
      var label = node.title.trim() || placeholderText(node);
      var editing = editingId === id;

      html += '<div class="' + classes + '" data-id="' + id + '" data-hidden-count="+' + hiddenCount + '"' +
        ' style="left:' + round(pos.x) + 'px;top:' + round(pos.y) + 'px;' +
        (animateNew ? "animation-delay:" + Math.min(index * 18, 180) + "ms;" : "") + '">' +
        '<span class="node-type-dot"></span>';

      if (editing) {
        html += '<textarea class="node-edit" maxlength="180" rows="4" placeholder="' +
          escapeHtml(placeholderText(node)) + '">' + escapeHtml(node.title) + "</textarea>";
      } else {
        html += '<span class="node-label">' + escapeHtml(label) + "</span>";
      }

      if (!placeholder) {
        html += '<span class="node-badge">' + typeLabel(node) +
          (node.status === "done" ? " · DONE" : "") + "</span>";
      }

      html += "</div>";
    });

    $("#mapNodes").html(html);
  }

  function placeholderText(node) {
    if (node.depth === 1) return "Add driver";
    if (node.depth === 2) return "Add action";
    return "Add step";
  }

  function countDescendants(id) {
    var node = state.nodes[id];
    if (!node) return 0;
    var count = 0;

    (node.children || []).forEach(function (childId) {
      if (!state.nodes[childId]) return;
      count += 1 + countDescendants(childId);
    });

    return count;
  }

  function selectNode(id, focus) {
    if (!state.nodes[id]) return;
    selectedId = id;
    editingId = null;
    renderAll(false);
    if (focus) focusCameraOnNode(id, Math.max(camera.scale, nodeFocusScale(state.nodes[id])));
  }

  function nodeFocusScale(node) {
    if (!node) return .9;
    if (node.depth === 0) return .9;
    if (node.depth === 1) return .78;
    if (node.depth === 2) return 1.05;
    return 1.12;
  }

  function commitNodeEdit(id) {
    var node = state.nodes[id];
    if (!node) return;

    var $edit = $('.map-node[data-id="' + id + '"] .node-edit');
    if ($edit.length) node.title = $edit.val().trim();

    editingId = null;
    saveState();
    renderAll(false);
  }

  function splitSelected() {
    if (!selectedId || !state.nodes[selectedId]) return;
    var node = state.nodes[selectedId];

    if (node.children.length) {
      node.collapsed = false;
      saveState();
      renderAll(true);
      focusCameraOnNode(selectedId, nodeFocusScale(node));
      showToast("Branch expanded.");
      return;
    }

    createEightSlots(selectedId);
    renderAll(true);
    focusCameraOnNode(selectedId, nodeFocusScale(node));
    showToast("Eight child nodes added.");
  }

  function toggleCollapseSelected() {
    if (!selectedId || !state.nodes[selectedId]) return;
    var node = state.nodes[selectedId];

    if (!node.children.length) {
      showToast("This node has no branch to collapse.");
      return;
    }

    node.collapsed = !node.collapsed;
    saveState();
    renderAll(false);

    if (!node.collapsed) focusCameraOnNode(selectedId, nodeFocusScale(node));
  }

  function updateSelectionBar() {
    var node = state.nodes[selectedId];
    if (!node) {
      $("#selectionBar").attr("hidden", true);
      return;
    }

    $("#selectionBar").removeAttr("hidden");
    $("#selectionType").text(typeLabel(node));
    $("#selectionTitle").text(node.title.trim() || placeholderText(node));
    $("#markDoneButton").text(node.status === "done" ? "Mark open" : "Mark done");
    $("#collapseButton").text(node.collapsed ? "Expand" : "Collapse");
    $("#collapseButton").prop("disabled", !node.children.length).css("opacity", node.children.length ? 1 : .45);
  }

  function typeLabel(node) {
    return LABELS[Math.min(node.depth || 0, 3)] || "STEP";
  }

  function focusCameraOnNode(id, targetScale) {
    var pos = renderPositions[id];
    if (!pos) return;

    var scale = clamp(targetScale || camera.scale, .24, 2.2);
    var x = viewportWidth() / 2 - pos.x * scale;
    var y = viewportHeight() / 2 - pos.y * scale;
    animateCameraTo(x, y, scale, 360);
  }

  function fitAll(animated) {
    if (!state.rootId) return;

    var bounds = getWorldBounds();
    if (!bounds) return;

    var vw = viewportWidth();
    var vh = viewportHeight();
    var pad = Math.min(vw, vh) * .13 + 60;
    var scaleX = (vw - pad * 2) / Math.max(bounds.width, 1);
    var scaleY = (vh - pad * 2) / Math.max(bounds.height, 1);
    var scale = clamp(Math.min(scaleX, scaleY), .24, 1.08);

    var centerX = bounds.minX + bounds.width / 2;
    var centerY = bounds.minY + bounds.height / 2;
    var x = vw / 2 - centerX * scale;
    var y = vh / 2 - centerY * scale;

    if (animated) animateCameraTo(x, y, scale, 360);
    else {
      camera = { x: x, y: y, scale: scale };
      applyCamera();
    }
  }

  function getWorldBounds() {
    var ids = Object.keys(renderPositions);
    if (!ids.length) return null;

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    ids.forEach(function (id) {
      var node = state.nodes[id];
      var pos = renderPositions[id];
      if (!node || !pos) return;

      var radius = nodeRadius(node.depth) + 35;
      minX = Math.min(minX, pos.x - radius);
      minY = Math.min(minY, pos.y - radius);
      maxX = Math.max(maxX, pos.x + radius);
      maxY = Math.max(maxY, pos.y + radius);
    });

    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1)
    };
  }

  function nodeRadius(depth) {
    if (depth === 0) return 95;
    if (depth === 1) return 71;
    if (depth === 2) return 54;
    return 44;
  }

  function applyCamera() {
    $("#mapWorld").css("transform", "translate(" + camera.x + "px," + camera.y + "px) scale(" + camera.scale + ")");
    $("#zoomReadout").text(Math.round(camera.scale * 100) + "%");
    renderMinimapCamera();
  }

  function animateCameraTo(x, y, scale, duration) {
    var start = { x: camera.x, y: camera.y, scale: camera.scale };
    var started = performance.now();
    duration = duration || 300;

    function frame(now) {
      var t = clamp((now - started) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - t, 3);

      camera.x = lerp(start.x, x, eased);
      camera.y = lerp(start.y, y, eased);
      camera.scale = lerp(start.scale, scale, eased);
      applyCamera();

      if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function zoomAt(screenX, screenY, targetScale) {
    if (!state.rootId) return;

    var newScale = clamp(targetScale, .24, 2.2);
    var worldX = (screenX - camera.x) / camera.scale;
    var worldY = (screenY - camera.y) / camera.scale;

    camera.x = screenX - worldX * newScale;
    camera.y = screenY - worldY * newScale;
    camera.scale = newScale;
    applyCamera();
  }

  function beginPinch() {
    var pts = Object.keys(pointers).map(function (id) { return pointers[id]; });
    if (pts.length !== 2) return;

    pinchState = {
      distance: distance(pts[0], pts[1]),
      scale: camera.scale,
      center: midpoint(pts[0], pts[1])
    };
    panState = null;
  }

  function updatePinch() {
    if (!pinchState) return;
    var pts = Object.keys(pointers).map(function (id) { return pointers[id]; });
    if (pts.length !== 2) return;

    var dist = Math.max(distance(pts[0], pts[1]), 1);
    var center = midpoint(pts[0], pts[1]);
    var rect = document.getElementById("mapViewport").getBoundingClientRect();
    var sx = center.x - rect.left;
    var sy = center.y - rect.top;
    zoomAt(sx, sy, pinchState.scale * (dist / pinchState.distance));
  }

  function renderMinimap() {
    var bounds = getWorldBounds();
    if (!bounds) {
      $("#minimap").attr("hidden", true);
      return;
    }

    $("#minimap").removeAttr("hidden");

    var w = $("#minimap").innerWidth() || 160;
    var h = $("#minimap").innerHeight() || 112;
    var html = "";

    Object.keys(renderPositions).forEach(function (id) {
      var node = state.nodes[id];
      var pos = renderPositions[id];
      if (!node || !pos) return;

      var left = ((pos.x - bounds.minX) / bounds.width) * w;
      var top = ((pos.y - bounds.minY) / bounds.height) * h;

      html += '<span class="minimap-node depth-' + Math.min(node.depth, 2) +
        (selectedId === id ? " selected" : "") +
        '" style="left:' + left + 'px;top:' + top + 'px"></span>';
    });

    $("#minimapWorld").html(html);
    renderMinimapCamera();
  }

  function renderMinimapCamera() {
    if (!state.rootId || $("#minimap").is("[hidden]")) return;
    var bounds = getWorldBounds();
    if (!bounds) return;

    var w = $("#minimap").innerWidth() || 160;
    var h = $("#minimap").innerHeight() || 112;

    var worldLeft = (0 - camera.x) / camera.scale;
    var worldTop = (0 - camera.y) / camera.scale;
    var worldRight = (viewportWidth() - camera.x) / camera.scale;
    var worldBottom = (viewportHeight() - camera.y) / camera.scale;

    var left = ((worldLeft - bounds.minX) / bounds.width) * w;
    var top = ((worldTop - bounds.minY) / bounds.height) * h;
    var width = ((worldRight - worldLeft) / bounds.width) * w;
    var height = ((worldBottom - worldTop) / bounds.height) * h;

    $("#minimapCamera").css({
      left: clamp(left, -w, w * 2) + "px",
      top: clamp(top, -h, h * 2) + "px",
      width: Math.max(width, 6) + "px",
      height: Math.max(height, 6) + "px"
    });
  }

  function viewportWidth() {
    return $("#mapViewport").innerWidth() || 1000;
  }

  function viewportHeight() {
    return $("#mapViewport").innerHeight() || 650;
  }

  function updateCanvasStatus() {
    var visibleCount = Object.keys(renderPositions).length;
    var total = Object.keys(state.nodes).length;
    var done = Object.keys(state.nodes).filter(function (id) {
      return state.nodes[id].status === "done";
    }).length;

    $("#canvasStatusText").text(
      visibleCount + " visible · " + total + " total · " + done + " done · Shift-drag to reposition"
    );
  }

  function startPromptRotation() {
    stopPromptRotation();

    promptTimer = setInterval(function () {
      if (state.rootId || $("#rootInput").is(":visible")) return;

      promptIndex = (promptIndex + 1) % PROMPTS.length;
      var $prompt = $("#rotatingPrompt");
      $prompt.addClass("swap-out");

      setTimeout(function () {
        $prompt.text(PROMPTS[promptIndex]).removeClass("swap-out");
      }, 180);
    }, 2800);
  }

  function stopPromptRotation() {
    if (promptTimer) {
      clearInterval(promptTimer);
      promptTimer = null;
    }
  }

  function openSuggestionModal() {
    if (!selectedId || !state.nodes[selectedId]) return;

    var node = state.nodes[selectedId];
    if (!node.children.length) createEightSlots(node.id);
    node.collapsed = false;

    suggestionBuffer = buildSuggestions(node, false);
    $("#suggestionTitle").text(node.depth === 0 ? "Suggested drivers" : "Suggested actions");
    renderSuggestions();
    renderAll(true);
    $("#suggestionModal").removeAttr("hidden");
  }

  function buildSuggestions(node, shuffle) {
    var title = ((node && node.title) || "").toLowerCase();
    var pool;

    if (node.depth === 0) {
      if (matchesAny(title, ["launch", "ship", "customer", "sale", "revenue", "mrr", "product", "beta"])) {
        pool = DRIVER_SUGGESTIONS.launch.slice();
      } else if (matchesAny(title, ["learn", "practice", "study", "ukulele", "guitar", "language"])) {
        pool = DRIVER_SUGGESTIONS.learn.slice();
      } else if (matchesAny(title, ["read", "book", "earthsea", "novel"])) {
        pool = DRIVER_SUGGESTIONS.read.slice();
      } else {
        pool = DRIVER_SUGGESTIONS.generic.slice();
      }
    } else {
      pool = ACTION_SUGGESTIONS[detectActionPool(title)].slice();
    }

    if (shuffle) pool = rotate(pool, 1 + Math.floor(Math.random() * 3));
    return pool;
  }

  function detectActionPool(title) {
    if (matchesAny(title, ["product", "quality", "ready", "qa", "test"])) return "product";
    if (matchesAny(title, ["price", "payment", "offer"])) return "pricing";
    if (matchesAny(title, ["customer", "icp", "audience"])) return "customer";
    if (matchesAny(title, ["prospect", "lead", "find"])) return "prospect";
    if (matchesAny(title, ["outreach", "email", "linkedin", "message", "sales"])) return "outreach";
    if (matchesAny(title, ["marketing", "distribution", "content", "launch"])) return "marketing";
    if (matchesAny(title, ["read", "book", "pages"])) return "read";
    if (matchesAny(title, ["learn", "study", "practice", "skill"])) return "learn";
    return "generic";
  }

  function renderSuggestions() {
    var html = suggestionBuffer.map(function (item, index) {
      return '<div class="suggestion-item">' +
        '<input type="checkbox" id="suggestion_' + index + '" data-index="' + index + '" checked>' +
        '<label for="suggestion_' + index + '">' +
        '<strong>' + escapeHtml(item) + '</strong>' +
        '<small>Fill one empty child node.</small>' +
        "</label></div>";
    }).join("");

    $("#suggestionList").html(html);
  }

  function applySuggestions() {
    var parent = state.nodes[selectedId];
    if (!parent) return;

    if (!parent.children.length) createEightSlots(parent.id);

    var selected = [];
    $("#suggestionList input:checked").each(function () {
      selected.push(suggestionBuffer[parseInt($(this).data("index"), 10)]);
    });

    var cursor = 0;

    parent.children.forEach(function (id) {
      var child = state.nodes[id];
      if (!child || child.title.trim() || cursor >= selected.length) return;
      child.title = selected[cursor++];
    });

    saveState();
    $("#suggestionModal").attr("hidden", true);
    renderAll(true);
    focusCameraOnNode(parent.id, nodeFocusScale(parent));
    showToast("Suggestions added to the map.");
  }

  function openNextModal() {
    var candidates = Object.keys(state.nodes)
      .map(function (id) { return state.nodes[id]; })
      .filter(function (node) {
        var hasFilledChildren = (node.children || []).some(function (childId) {
          return state.nodes[childId] && state.nodes[childId].title.trim();
        });

        return node.title.trim() &&
          node.status !== "done" &&
          !hasFilledChildren &&
          node.depth >= 2;
      });

    candidates.sort(function (a, b) {
      return scoreNode(b) - scoreNode(a);
    });

    currentNextId = candidates.length ? candidates[0].id : null;

    if (!currentNextId) {
      $("#nextActionTitle").text("Nothing actionable yet.");
      $("#nextActionMeta").text("Add actions under a driver, or split a broad action into smaller steps.");
      $("#openNextAction, #completeNextAction").prop("disabled", true).css("opacity", .45);
    } else {
      var node = state.nodes[currentNextId];
      var meta = [];
      if (node.duration) meta.push(node.duration + " min");
      meta.push("impact " + (node.impact || 3) + "/5");
      meta.push("effort " + (node.effort || 3) + "/5");

      $("#nextActionTitle").text(node.title);
      $("#nextActionMeta").text(meta.join(" · "));
      $("#openNextAction, #completeNextAction").prop("disabled", false).css("opacity", 1);
    }

    $("#nextModal").removeAttr("hidden");
  }

  function scoreNode(node) {
    var impact = parseInt(node.impact || 3, 10);
    var effort = parseInt(node.effort || 3, 10);
    var urgency = parseInt(node.urgency || 3, 10);
    return impact * 2 + urgency - effort;
  }

  function openInspector(id) {
    var node = state.nodes[id];
    if (!node) return;

    selectedDetailId = id;
    $("#inspectorTitle").text(typeLabel(node).toLowerCase());
    $("#detailTitle").val(node.title);
    $("#impactInput").val(node.impact || 3);
    $("#effortInput").val(node.effort || 3);
    $("#urgencyInput").val(node.urgency || 3);
    $("#impactOutput").text(node.impact || 3);
    $("#effortOutput").text(node.effort || 3);
    $("#urgencyOutput").text(node.urgency || 3);
    $("#durationInput").val(node.duration || "");
    $("#statusInput").val(node.status || "open");
    $("#notesInput").val(node.notes || "");
    $("#deleteNodeButton").toggle(node.id !== state.rootId);
    updatePriorityCard(node);

    $("#inspector").addClass("open").attr("aria-hidden", "false");
  }

  function closeInspector() {
    $("#inspector").removeClass("open").attr("aria-hidden", "true");
    if (selectedDetailId) renderAll(false);
    selectedDetailId = null;
  }

  function updateSelectedDetail(key, value) {
    if (!selectedDetailId || !state.nodes[selectedDetailId]) return;

    state.nodes[selectedDetailId][key] = value;
    saveState();

    if (key === "title") {
      updateSelectionBar();
      renderAll(false);
    }
  }

  function updatePriorityCard(node) {
    var impact = parseInt(node.impact || 3, 10);
    var effort = parseInt(node.effort || 3, 10);
    var urgency = parseInt(node.urgency || 3, 10);
    var label = "Balanced";
    var copy = "Useful, but not an obvious first move.";

    if (impact >= 4 && effort <= 2) {
      label = "Quick win";
      copy = "High impact with relatively low effort. Strong candidate to do early.";
    } else if (impact >= 4 && effort >= 4) {
      label = "Major move";
      copy = "High impact, high effort. Schedule it or break it down further.";
    } else if (impact <= 2 && effort >= 4) {
      label = "Low leverage";
      copy = "High effort for limited impact. Consider dropping or redesigning it.";
    } else if (urgency >= 4 && impact >= 3) {
      label = "Do soon";
      copy = "Meaningful and time-sensitive. Avoid unnecessary delay.";
    } else if (impact <= 2 && urgency <= 2) {
      label = "Defer or drop";
      copy = "Low impact and low urgency. It should not displace stronger work.";
    }

    $("#priorityLabel").text(label);
    $("#priorityCopy").text(copy);
  }

  function clearSelectedNode() {
    if (!selectedDetailId || selectedDetailId === state.rootId) return;

    var node = state.nodes[selectedDetailId];
    if (!node) return;

    (node.children || []).slice().forEach(removeNodeRecursive);

    node.children = [];
    node.title = "";
    node.status = "open";
    node.impact = 3;
    node.effort = 3;
    node.urgency = 3;
    node.duration = "";
    node.notes = "";
    node.collapsed = false;
    node.offsetX = 0;
    node.offsetY = 0;

    saveState();
    closeInspector();
    renderAll(false);
    showToast("Node cleared.");
  }

  function removeNodeRecursive(id) {
    var node = state.nodes[id];
    if (!node) return;
    (node.children || []).forEach(removeNodeRecursive);
    delete state.nodes[id];
  }

  function resetAll() {
    if (state.rootId && !window.confirm("Start a new map? Your current local map will be cleared.")) return;

    state = defaultState();
    selectedId = null;
    editingId = null;
    selectedDetailId = null;
    currentNextId = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    closeInspector();
    showEmptyMap();
    startPromptRotation();
  }

  function toggleTheme() {
    var dark = !$("body").hasClass("dark");
    $("body").toggleClass("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }

  function applyStoredTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    var dark = stored ? stored === "dark" : false;
    $("body").toggleClass("dark", dark);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    $("#toast").text(message).addClass("show");
    toastTimer = setTimeout(function () {
      $("#toast").removeClass("show");
    }, 2100);
  }

  function matchesAny(text, words) {
    return words.some(function (word) {
      return text.indexOf(word) !== -1;
    });
  }

  function rotate(arr, n) {
    return arr.slice(n).concat(arr.slice(0, n));
  }

  function round(value) {
    return Math.round(value * 10) / 10;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function distance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }
})(jQuery);
