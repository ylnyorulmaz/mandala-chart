(function ($) {
  "use strict";

  var STORAGE_KEY = "mandala-chart-state-v1";
  var THEME_KEY = "mandala-chart-theme-v1";
  var state = loadState();
  var focusedId = state.rootId || null;
  var selectedDetailId = null;
  var suggestionBuffer = [];
  var currentNextId = null;
  var toastTimer = null;

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
    fitness: [
      "Training plan",
      "Schedule",
      "Nutrition",
      "Sleep",
      "Recovery",
      "Tracking",
      "Environment",
      "Consistency"
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
      "Test empty and error states",
      "Verify export / output quality",
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
    bindEvents();
    applyStoredTheme();
    autoResize($("#goalInput"));

    if (state.rootId && state.nodes[state.rootId]) {
      focusedId = focusedId || state.rootId;
      showMap(false);
    } else {
      showStarter();
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  }

  function defaultState() {
    return {
      rootId: null,
      nodes: {},
      version: 1
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.nodes) return defaultState();
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return "n_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
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
      createdAt: Date.now()
    };
    if (parentId && state.nodes[parentId]) {
      state.nodes[parentId].children.push(id);
    }
    return state.nodes[id];
  }

  function createSlots(parentId) {
    var parent = state.nodes[parentId];
    if (!parent || parent.children.length) return;

    for (var i = 0; i < 8; i++) {
      createNode("", parentId, parent.depth + 1);
    }

    saveState();
  }

  function bindEvents() {
    $("#goalForm").on("submit", function (e) {
      e.preventDefault();
      var value = $("#goalInput").val().trim();
      if (!value) {
        shake($("#goalInput"));
        return;
      }
      startGoal(value);
    });

    $(".example-chip").on("click", function () {
      $("#goalInput").val($(this).data("example")).trigger("input").focus();
    });

    $("#goalInput").on("input", function () {
      autoResize($(this));
    });

    $("#brandButton").on("click", function () {
      if (!state.rootId) return;
      focusedId = state.rootId;
      renderMap(false);
    });

    $("#focusTitle").on("input", function () {
      var node = state.nodes[focusedId];
      if (!node) return;
      node.title = $(this).val();
      saveState();
      renderBreadcrumbs();
    });

    $("#focusTitle").on("blur", function () {
      renderMap(false);
    });

    $("#focusEditButton").on("click", function () {
      openInspector(focusedId);
    });

    $("#focusDoneButton").on("click", function () {
      toggleDone(focusedId);
    });

    $("#childrenLayer").on("click", ".child-node", function (e) {
      if ($(e.target).is("textarea")) return;
      var id = $(this).data("id");
      var node = state.nodes[id];
      if (!node || !node.title.trim()) {
        $(this).find("textarea").focus();
        return;
      }
      openChild(id);
    });

    $("#childrenLayer").on("input", ".child-input", function () {
      var id = $(this).closest(".child-node").data("id");
      var node = state.nodes[id];
      if (!node) return;
      node.title = $(this).val();
      saveState();
      $(this).closest(".child-node").toggleClass("filled", !!node.title.trim());
      autoResize($(this));
    });

    $("#childrenLayer").on("keydown", ".child-input", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $(this).blur();
      }
    });

    $("#childrenLayer").on("blur", ".child-input", function () {
      var id = $(this).closest(".child-node").data("id");
      var node = state.nodes[id];
      if (!node) return;
      node.title = $(this).val().trim();
      saveState();
      renderMap(false);
    });

    $("#childrenLayer").on("dblclick", ".child-node", function () {
      openInspector($(this).data("id"));
    });

    $("#backButton").on("click", goBack);
    $("#splitButton, #decomposeButton").on("click", function () {
      splitFocused();
    });

    $("#assistButton").on("click", openSuggestionModal);
    $("#closeSuggestionModal").on("click", function () {
      $("#suggestionModal").attr("hidden", true);
    });

    $("#shuffleSuggestions").on("click", function () {
      suggestionBuffer = buildSuggestions(state.nodes[focusedId], true);
      renderSuggestions();
    });

    $("#applySuggestions").on("click", applySuggestions);

    $("#suggestionModal, #focusModal").on("click", function (e) {
      if (e.target === this) $(this).attr("hidden", true);
    });

    $("#focusModeButton").on("click", openFocusMode);
    $("#closeFocusModal").on("click", function () {
      $("#focusModal").attr("hidden", true);
    });

    $("#openNextAction").on("click", function () {
      if (!currentNextId) return;
      $("#focusModal").attr("hidden", true);
      focusedId = currentNextId;
      renderMap(false);
    });

    $("#completeNextAction").on("click", function () {
      if (!currentNextId) return;
      state.nodes[currentNextId].status = "done";
      saveState();
      showToast("Done. Next action recalculated.");
      openFocusMode();
      renderMap(false);
    });

    $("#resetButton").on("click", resetAll);
    $("#exportButton").on("click", exportState);
    $("#themeButton").on("click", toggleTheme);

    $("#closeInspector").on("click", closeInspector);

    $("#detailTitle").on("input", function () {
      updateSelectedDetail("title", $(this).val());
    });

    $("#impactInput, #effortInput, #urgencyInput").on("input", function () {
      if (!selectedDetailId) return;
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
      renderMap(false);
    });

    $("#notesInput").on("input", function () {
      updateSelectedDetail("notes", $(this).val());
    });

    $("#deleteNodeButton").on("click", deleteSelectedNode);

    $(window).on("resize", debounce(function () {
      drawConnectors();
    }, 100));

    $(document).on("keydown", function (e) {
      if (e.key === "Escape") {
        closeInspector();
        $("#suggestionModal, #focusModal").attr("hidden", true);
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (state.rootId) openFocusMode();
      }
    });
  }

  function startGoal(title) {
    state = defaultState();
    var root = createNode(title, null, 0);
    state.rootId = root.id;
    focusedId = root.id;
    createSlots(root.id);
    saveState();

    $("#emptyState").fadeOut(180, function () {
      showMap(true);
    });
  }

  function showStarter() {
    $("#mapStage, #floatingToolbar").attr("hidden", true);
    $("#emptyState").removeAttr("hidden").show();
    $("#breadcrumbs").empty();
  }

  function showMap(animateChildren) {
    $("#emptyState").hide();
    $("#mapStage, #floatingToolbar").removeAttr("hidden");
    renderMap(animateChildren);
  }

  function openChild(id) {
    var node = state.nodes[id];
    if (!node) return;

    focusedId = id;

    if (node.depth <= 1 && !node.children.length) {
      createSlots(id);
      renderMap(true);
    } else {
      renderMap(false);
    }
  }

  function splitFocused() {
    var node = state.nodes[focusedId];
    if (!node) return;

    if (node.children.length) {
      showToast("This branch is already split.");
      return;
    }

    createSlots(focusedId);
    renderMap(true);
  }

  function renderMap(animateChildren) {
    var node = state.nodes[focusedId];
    if (!node) {
      focusedId = state.rootId;
      node = state.nodes[focusedId];
      if (!node) return showStarter();
    }

    $("#focusNode").toggleClass("done", node.status === "done");
    $("#focusTitle").val(node.title);
    $("#focusType").text(typeLabel(node));
    $("#focusStatus").text(statusLabel(node.status));
    $("#stageKicker").text(typeLabel(node));
    $("#stageHelp").text(stageHelp(node));

    renderBreadcrumbs();
    renderChildren(node, animateChildren);

    var hasChildren = node.children && node.children.length;
    $("#emptyBranch").attr("hidden", hasChildren);
    $("#backButton").css("opacity", node.parentId ? 1 : .45);

    window.requestAnimationFrame(drawConnectors);
  }

  function typeLabel(node) {
    return LABELS[Math.min(node.depth, 3)] || "STEP";
  }

  function statusLabel(status) {
    if (status === "done") return "COMPLETED";
    if (status === "doing") return "IN PROGRESS";
    return "";
  }

  function stageHelp(node) {
    if (node.depth === 0) return "Define the eight drivers that make this outcome possible.";
    if (node.depth === 1) return "Turn this driver into concrete, controllable actions.";
    if (!node.children.length) return "If this is still too broad, split it again. If it is executable, do it.";
    return "Keep breaking down only while it reduces friction.";
  }

  function renderBreadcrumbs() {
    var path = ancestry(focusedId);
    var html = "";

    path.forEach(function (id, index) {
      var node = state.nodes[id];
      if (!node) return;
      if (index > 0) html += '<span class="crumb-sep">›</span>';
      html += '<button class="crumb ' + (id === focusedId ? "current" : "") + '" data-id="' + id + '">' +
        escapeHtml(node.title || typeLabel(node)) +
        "</button>";
    });

    $("#breadcrumbs").html(html);
    $("#breadcrumbs .crumb").on("click", function () {
      focusedId = $(this).data("id");
      renderMap(false);
    });
  }

  function renderChildren(parent, animateChildren) {
    var $layer = $("#childrenLayer");
    $layer.empty();

    if (!parent.children || !parent.children.length) {
      drawConnectors();
      return;
    }

    var radius = getRadius();
    var count = parent.children.length;

    parent.children.forEach(function (id, index) {
      var node = state.nodes[id];
      if (!node) return;

      var angle = (-90 + index * (360 / count)) * Math.PI / 180;
      var x = Math.cos(angle) * radius;
      var y = Math.sin(angle) * radius;
      var filled = !!node.title.trim();
      var meta = [];

      if (node.duration) meta.push('<span class="pill">' + escapeHtml(node.duration) + 'm</span>');
      if (node.status === "done") meta.push('<span class="pill">done</span>');
      else if (filled && !node.children.length) meta.push('<span class="child-open-hint">open ↗</span>');
      else if (node.children.length) meta.push('<span class="pill">' + node.children.length + ' nodes</span>');

      var $card = $('<div class="child-node' +
        (filled ? " filled" : "") +
        (node.status === "done" ? " done" : "") +
        (animateChildren ? " entering" : "") +
        '" data-id="' + id + '"></div>');

      $card.css({
        "--x": x + "px",
        "--y": y + "px",
        "--delay": (index * 52) + "ms"
      });

      $card.append('<div class="slot-index">' + pad(index + 1) + " · " + typeLabel(node) + "</div>");
      var $input = $('<textarea class="child-input" rows="2" maxlength="180"></textarea>');
      $input.val(node.title);
      $input.attr("placeholder", node.depth === 1 ? "Add a driver…" : "Add an action…");
      $card.append($input);
      $card.append('<div class="child-meta">' + meta.join("") + "</div>");
      $layer.append($card);

      autoResize($input);
    });
  }

  function getRadius() {
    var map = document.getElementById("radialMap");
    if (!map) return 260;
    var css = getComputedStyle(map).getPropertyValue("--map-radius").trim();
    var temp = document.createElement("div");
    temp.style.position = "absolute";
    temp.style.visibility = "hidden";
    temp.style.width = css;
    document.body.appendChild(temp);
    var px = temp.getBoundingClientRect().width;
    temp.remove();
    return px || 260;
  }

  function drawConnectors() {
    var svg = $("#connectors");
    var canvas = document.getElementById("canvas");
    var focus = document.getElementById("focusNode");
    if (!canvas || !focus || $("#mapStage").is("[hidden]")) {
      svg.empty();
      return;
    }

    var canvasRect = canvas.getBoundingClientRect();
    var focusRect = focus.getBoundingClientRect();
    var x1 = focusRect.left + focusRect.width / 2 - canvasRect.left;
    var y1 = focusRect.top + focusRect.height / 2 - canvasRect.top;
    var lines = "";

    $(".child-node").each(function () {
      var rect = this.getBoundingClientRect();
      var x2 = rect.left + rect.width / 2 - canvasRect.left;
      var y2 = rect.top + rect.height / 2 - canvasRect.top;
      lines += '<line class="connector-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>';
    });

    svg.attr("viewBox", "0 0 " + canvasRect.width + " " + canvasRect.height);
    svg.html(lines);
  }

  function ancestry(id) {
    var list = [];
    var cursor = state.nodes[id];

    while (cursor) {
      list.unshift(cursor.id);
      cursor = cursor.parentId ? state.nodes[cursor.parentId] : null;
    }

    return list;
  }

  function goBack() {
    var node = state.nodes[focusedId];
    if (!node || !node.parentId) return;
    focusedId = node.parentId;
    renderMap(false);
  }

  function toggleDone(id) {
    var node = state.nodes[id];
    if (!node) return;
    node.status = node.status === "done" ? "open" : "done";
    saveState();
    renderMap(false);
  }

  function openInspector(id) {
    var node = state.nodes[id];
    if (!node) return;

    selectedDetailId = id;
    $("#inspectorHeading").text(typeLabel(node).toLowerCase());
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
    if (selectedDetailId) {
      renderMap(false);
    }
    selectedDetailId = null;
  }

  function updateSelectedDetail(key, value) {
    if (!selectedDetailId || !state.nodes[selectedDetailId]) return;
    state.nodes[selectedDetailId][key] = value;
    saveState();

    if (key === "title" && selectedDetailId === focusedId) {
      $("#focusTitle").val(value);
      renderBreadcrumbs();
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

  function deleteSelectedNode() {
    if (!selectedDetailId || selectedDetailId === state.rootId) return;

    var node = state.nodes[selectedDetailId];
    if (!node) return;

    var parentId = node.parentId;
    removeNodeRecursive(selectedDetailId);

    if (state.nodes[parentId]) {
      state.nodes[parentId].children = state.nodes[parentId].children.filter(function (id) {
        return id !== selectedDetailId;
      });
    }

    if (focusedId === selectedDetailId) focusedId = parentId;
    saveState();
    closeInspector();
    renderMap(false);
    showToast("Node deleted.");
  }

  function removeNodeRecursive(id) {
    var node = state.nodes[id];
    if (!node) return;
    (node.children || []).forEach(removeNodeRecursive);
    delete state.nodes[id];
  }

  function openSuggestionModal() {
    var node = state.nodes[focusedId];
    if (!node) return;

    if (!node.children.length) createSlots(focusedId);

    suggestionBuffer = buildSuggestions(node, false);
    $("#suggestionTitle").text(node.depth === 0 ? "Suggested drivers" : "Suggested actions");
    $("#suggestionSubtitle").text("Front-end demo suggestions. The AI API hook comes next.");
    renderSuggestions();
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
      } else if (matchesAny(title, ["read", "book", "earthsea", "finish novel"])) {
        pool = DRIVER_SUGGESTIONS.read.slice();
      } else if (matchesAny(title, ["fitness", "run", "gym", "marathon", "weight"])) {
        pool = DRIVER_SUGGESTIONS.fitness.slice();
      } else {
        pool = DRIVER_SUGGESTIONS.generic.slice();
      }
    } else {
      var key = detectActionPool(title);
      pool = ACTION_SUGGESTIONS[key].slice();
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
        '<small>Use this to fill an empty node.</small>' +
        '</label></div>';
    }).join("");

    $("#suggestionList").html(html);
  }

  function applySuggestions() {
    var parent = state.nodes[focusedId];
    if (!parent) return;

    if (!parent.children.length) createSlots(parent.id);

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
    renderMap(true);
    showToast("Suggestions added to empty nodes.");
  }

  function openFocusMode() {
    var candidates = Object.keys(state.nodes)
      .map(function (id) { return state.nodes[id]; })
      .filter(function (node) {
        return node.title.trim() &&
          node.status !== "done" &&
          (!node.children || !node.children.some(function (childId) {
            var c = state.nodes[childId];
            return c && c.title.trim();
          })) &&
          node.depth >= 2;
      });

    candidates.sort(function (a, b) {
      return scoreNode(b) - scoreNode(a);
    });

    currentNextId = candidates.length ? candidates[0].id : null;

    if (!currentNextId) {
      $("#nextActionTitle").text("Nothing actionable yet.");
      $("#nextActionMeta").text("Fill or split a branch until you have one concrete action.");
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

    $("#focusModal").removeAttr("hidden");
  }

  function scoreNode(node) {
    var impact = parseInt(node.impact || 3, 10);
    var effort = parseInt(node.effort || 3, 10);
    var urgency = parseInt(node.urgency || 3, 10);
    return impact * 2 + urgency - effort;
  }

  function resetAll() {
    var hasData = !!state.rootId;
    if (hasData && !window.confirm("Start a new map? Your current local map will be cleared.")) return;

    state = defaultState();
    focusedId = null;
    selectedDetailId = null;
    currentNextId = null;
    localStorage.removeItem(STORAGE_KEY);
    closeInspector();
    $("#goalInput").val("");
    showStarter();
  }

  function exportState() {
    if (!state.rootId) return;

    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "mandala-map.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Map exported.");
  }

  function toggleTheme() {
    var isLight = !$("body").hasClass("light");
    $("body").toggleClass("light", isLight);
    localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
  }

  function applyStoredTheme() {
    var theme = localStorage.getItem(THEME_KEY);
    $("body").toggleClass("light", theme === "light");
  }

  function autoResize($el) {
    if (!$el || !$el.length) return;
    $el.css("height", "auto");
    $el.css("height", Math.min($el[0].scrollHeight, 160) + "px");
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    $("#toast").text(message).addClass("show");
    toastTimer = setTimeout(function () {
      $("#toast").removeClass("show");
    }, 2200);
  }

  function shake($el) {
    $el.css("transform", "translateX(-6px)");
    setTimeout(function () { $el.css("transform", "translateX(5px)"); }, 70);
    setTimeout(function () { $el.css("transform", "translateX(0)"); }, 140);
  }

  function matchesAny(text, words) {
    return words.some(function (word) {
      return text.indexOf(word) !== -1;
    });
  }

  function rotate(arr, n) {
    return arr.slice(n).concat(arr.slice(0, n));
  }

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
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
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }
})(jQuery);
