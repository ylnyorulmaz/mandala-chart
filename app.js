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
  var promptTimer = null;
  var promptIndex = 0;

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

    if (!$("#mandalaStage").length) return;

    bindPlannerEvents();

    if (state.rootId && state.nodes[state.rootId]) {
      focusedId = focusedId || state.rootId;
      stopPromptRotation();
      renderMap(false);
    } else {
      showFreshGoal();
      startPromptRotation();
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
    $("#centerNode").on("click", function (e) {
      if ($(e.target).is("textarea, button")) return;
      openCenterEditor();
    });

    $("#centerNode").on("keydown", function (e) {
      if (e.key === "Enter" && !$(e.target).is("textarea")) {
        e.preventDefault();
        openCenterEditor();
      }
    });

    $("#centerInput").on("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitCenter();
      }
    });

    $("#centerInput").on("blur", function () {
      if ($(this).val().trim()) commitCenter();
    });

    $("#centerInput").on("input", function () {
      if (!focusedId) return;
      state.nodes[focusedId].title = $(this).val();
      saveState();
      renderBreadcrumbs();
    });

    $("#centerDetailsButton").on("click", function (e) {
      e.stopPropagation();
      if (!focusedId) return;
      openInspector(focusedId);
    });

    $("#childLayer").on("input", ".child-input", function () {
      var id = $(this).closest(".child-node").data("id");
      var node = state.nodes[id];
      if (!node) return;
      node.title = $(this).val();
      saveState();
      $(this).closest(".child-node").toggleClass("filled", !!node.title.trim());
    });

    $("#childLayer").on("keydown", ".child-input", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $(this).blur();
      }
    });

    $("#childLayer").on("click", ".child-node", function (e) {
      if ($(e.target).is("textarea")) return;
      var id = $(this).data("id");
      var node = state.nodes[id];

      if (!node || !node.title.trim()) {
        $(this).find("textarea").focus();
        return;
      }

      focusNode(id);
    });

    $("#childLayer").on("dblclick", ".child-node", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openInspector($(this).data("id"));
    });

    $("#breadcrumbs").on("click", ".crumb", function () {
      var id = $(this).data("id");
      if (!state.nodes[id]) return;
      focusedId = id;
      renderMap(false);
    });

    $("#suggestButton").on("click", openSuggestionModal);
    $("#nextButton").on("click", openNextModal);
    $("#exportButton").on("click", exportState);
    $("#resetButton").on("click", resetAll);
    $("#splitButton").on("click", splitFocused);

    $("#closeSuggestionModal").on("click", function () {
      $("#suggestionModal").attr("hidden", true);
    });

    $("#shuffleSuggestions").on("click", function () {
      suggestionBuffer = buildSuggestions(state.nodes[focusedId], true);
      renderSuggestions();
    });

    $("#applySuggestions").on("click", applySuggestions);

    $("#closeNextModal").on("click", function () {
      $("#nextModal").attr("hidden", true);
    });

    $("#openNextAction").on("click", function () {
      if (!currentNextId) return;
      $("#nextModal").attr("hidden", true);
      focusedId = currentNextId;
      renderMap(false);
    });

    $("#completeNextAction").on("click", function () {
      if (!currentNextId || !state.nodes[currentNextId]) return;
      state.nodes[currentNextId].status = "done";
      saveState();
      showToast("Done. Recalculating the next move.");
      renderMap(false);
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
      renderMap(false);
    });

    $("#notesInput").on("input", function () {
      updateSelectedDetail("notes", $(this).val());
    });

    $("#deleteNodeButton").on("click", deleteSelectedNode);

    $(window).on("resize", debounce(function () {
      if (focusedId) renderChildren(state.nodes[focusedId], false);
      drawLines();
    }, 100));

    $(document).on("keydown", function (e) {
      if (e.key === "Escape") {
        closeInspector();
        $("#suggestionModal, #nextModal").attr("hidden", true);
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && state.rootId) {
        e.preventDefault();
        openNextModal();
      }
    });
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

  function createEightSlots(parentId) {
    var parent = state.nodes[parentId];
    if (!parent || parent.children.length) return;

    for (var i = 0; i < 8; i++) {
      createNode("", parentId, parent.depth + 1);
    }

    saveState();
  }

  function showFreshGoal() {
    focusedId = null;
    $("#plannerActions, #plannerLegend, #stageEmptyNote").attr("hidden", true);
    $("#breadcrumbs").empty();
    $("#childLayer, #nodeLines").empty();
    $("#plannerHint").text("Start with one thing. We will break it down only as far as needed.");
    $("#centerNode").addClass("idle").attr("aria-label", "Enter your goal");
    $("#centerPrompt").removeAttr("hidden");
    $("#centerEditor").attr("hidden", true);
    $("#centerInput").val("");
  }

  function openCenterEditor() {
    stopPromptRotation();
    $("#centerNode").removeClass("idle");
    $("#centerPrompt").attr("hidden", true);
    $("#centerEditor").removeAttr("hidden");

    if (focusedId && state.nodes[focusedId]) {
      $("#centerEyebrow").text(typeLabel(state.nodes[focusedId]));
      $("#centerInput").val(state.nodes[focusedId].title);
    } else {
      $("#centerEyebrow").text("GOAL");
      $("#centerInput").val("");
    }

    setTimeout(function () {
      $("#centerInput").focus();
      var input = $("#centerInput")[0];
      if (input) input.setSelectionRange(input.value.length, input.value.length);
    }, 30);
  }

  function commitCenter() {
    var value = $("#centerInput").val().trim();
    if (!value) {
      if (!state.rootId) {
        showFreshGoal();
        startPromptRotation();
      }
      return;
    }

    if (!state.rootId) {
      var root = createNode(value, null, 0);
      state.rootId = root.id;
      focusedId = root.id;
      createEightSlots(root.id);
      saveState();
      renderMap(true);
      showToast("Now define the eight drivers.");
      return;
    }

    if (focusedId && state.nodes[focusedId]) {
      state.nodes[focusedId].title = value;
      saveState();
      renderMap(false);
    }
  }

  function renderMap(animate) {
    if (!focusedId || !state.nodes[focusedId]) {
      focusedId = state.rootId;
    }

    var node = state.nodes[focusedId];
    if (!node) {
      showFreshGoal();
      return;
    }

    stopPromptRotation();
    $("#plannerActions, #plannerLegend").removeAttr("hidden");
    $("#centerNode").removeClass("idle");
    $("#centerPrompt").attr("hidden", true);
    $("#centerEditor").removeAttr("hidden");
    $("#centerEyebrow").text(typeLabel(node));
    $("#centerInput").val(node.title);
    $("#plannerHint").text(stageHint(node));
    $("#stageEmptyNote").attr("hidden", !!node.children.length);

    renderBreadcrumbs();
    renderChildren(node, animate);
    window.requestAnimationFrame(drawLines);
  }

  function renderBreadcrumbs() {
    if (!focusedId) {
      $("#breadcrumbs").empty();
      return;
    }

    var path = ancestry(focusedId);
    var html = "";

    path.forEach(function (id, index) {
      var node = state.nodes[id];
      if (!node) return;
      if (index) html += '<span class="crumb-sep">›</span>';
      html += '<button class="crumb ' + (id === focusedId ? "current" : "") + '" data-id="' + id + '">' +
        escapeHtml(node.title || typeLabel(node)) +
        "</button>";
    });

    $("#breadcrumbs").html(html);
  }

  function renderChildren(parent, animate) {
    var $layer = $("#childLayer");
    $layer.empty();

    if (!parent || !parent.children || !parent.children.length) {
      drawLines();
      return;
    }

    var positions = getGridPositions();

    parent.children.slice(0, 8).forEach(function (id, index) {
      var node = state.nodes[id];
      if (!node) return;

      var pos = positions[index];
      var filled = !!node.title.trim();
      var meta = [];

      if (node.duration) meta.push('<span class="meta-pill">' + escapeHtml(node.duration) + 'm</span>');
      if (node.status === "done") meta.push('<span class="meta-pill">done</span>');
      else if (node.children && node.children.some(function (childId) {
        return state.nodes[childId] && state.nodes[childId].title.trim();
      })) {
        meta.push('<span class="meta-pill">open branch</span>');
      } else if (filled) {
        meta.push('<span>click to open ↗</span>');
      }

      var $node = $('<div class="child-node' +
        (filled ? " filled" : "") +
        (node.status === "done" ? " done" : "") +
        (animate ? " entering" : "") +
        '" data-id="' + id + '"></div>');

      $node.css({
        "--x": pos.x + "px",
        "--y": pos.y + "px",
        "--delay": (index * 55) + "ms"
      });

      $node.append('<span class="child-index">' + pad(index + 1) + " · " + typeLabel(node) + "</span>");

      var $input = $('<textarea class="child-input" rows="3" maxlength="180"></textarea>');
      $input.val(node.title);
      $input.attr("placeholder", placeholderFor(node));
      $node.append($input);
      $node.append('<div class="child-meta">' + meta.join("") + "</div>");
      $layer.append($node);
    });
  }

  function getGridPositions() {
    var width = window.innerWidth;

    if (width <= 680) {
      return [
        { x: -120, y: -118 },
        { x: 0, y: -176 },
        { x: 120, y: -118 },
        { x: 168, y: 0 },
        { x: 120, y: 118 },
        { x: 0, y: 176 },
        { x: -120, y: 118 },
        { x: -168, y: 0 }
      ];
    }

    if (width <= 900) {
      return [
        { x: -210, y: -170 },
        { x: 0, y: -245 },
        { x: 210, y: -170 },
        { x: 295, y: 0 },
        { x: 210, y: 170 },
        { x: 0, y: 245 },
        { x: -210, y: 170 },
        { x: -295, y: 0 }
      ];
    }

    return [
      { x: -260, y: -205 },
      { x: 0, y: -268 },
      { x: 260, y: -205 },
      { x: 350, y: 0 },
      { x: 260, y: 205 },
      { x: 0, y: 268 },
      { x: -260, y: 205 },
      { x: -350, y: 0 }
    ];
  }

  function drawLines() {
    var stage = document.getElementById("mandalaStage");
    var center = document.getElementById("centerNode");
    var svg = $("#nodeLines");

    if (!stage || !center || !focusedId || !$(".child-node").length) {
      svg.empty();
      return;
    }

    var stageRect = stage.getBoundingClientRect();
    var centerRect = center.getBoundingClientRect();
    var x1 = centerRect.left + centerRect.width / 2 - stageRect.left;
    var y1 = centerRect.top + centerRect.height / 2 - stageRect.top;
    var html = "";

    $(".child-node").each(function () {
      var rect = this.getBoundingClientRect();
      var x2 = rect.left + rect.width / 2 - stageRect.left;
      var y2 = rect.top + rect.height / 2 - stageRect.top;
      html += '<line class="node-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>';
    });

    svg.attr("viewBox", "0 0 " + stageRect.width + " " + stageRect.height);
    svg.html(html);
  }

  function focusNode(id) {
    var node = state.nodes[id];
    if (!node) return;

    focusedId = id;

    if (node.depth === 1 && !node.children.length) {
      createEightSlots(id);
      renderMap(true);
      showToast("Turn this driver into eight concrete actions.");
      return;
    }

    renderMap(false);
  }

  function splitFocused() {
    if (!focusedId || !state.nodes[focusedId]) return;
    var node = state.nodes[focusedId];

    if (node.children.length) {
      showToast("This node is already split.");
      return;
    }

    createEightSlots(focusedId);
    renderMap(true);
  }

  function placeholderFor(node) {
    if (node.depth === 1) return "Add a driver…";
    if (node.depth === 2) return "Add an action…";
    return "Add a smaller step…";
  }

  function typeLabel(node) {
    return LABELS[Math.min(node.depth || 0, 3)] || "STEP";
  }

  function stageHint(node) {
    if (node.depth === 0) {
      return "What must be true for this goal to happen? Define the eight strongest drivers.";
    }

    if (node.depth === 1) {
      return "What can you actually do to move this driver? Make each action concrete and controllable.";
    }

    if (!node.children.length) {
      return "If this still feels too big to start, split it. If it is obvious and executable, do it.";
    }

    return "Keep decomposing only while it reduces friction. Stop when the next move is obvious.";
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

  function startPromptRotation() {
    stopPromptRotation();

    promptTimer = setInterval(function () {
      if (state.rootId || $("#centerEditor").is(":visible")) return;
      promptIndex = (promptIndex + 1) % PROMPTS.length;
      var $prompt = $("#rotatingPrompt");

      $prompt.addClass("swap-out");
      setTimeout(function () {
        $prompt.text(PROMPTS[promptIndex]).removeClass("swap-out");
      }, 190);
    }, 2800);
  }

  function stopPromptRotation() {
    if (promptTimer) {
      clearInterval(promptTimer);
      promptTimer = null;
    }
  }

  function openSuggestionModal() {
    if (!focusedId || !state.nodes[focusedId]) return;

    var node = state.nodes[focusedId];
    if (!node.children.length) createEightSlots(node.id);

    suggestionBuffer = buildSuggestions(node, false);
    $("#suggestionTitle").text(node.depth === 0 ? "Suggested drivers" : "Suggested actions");
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
        '<small>Fill one empty node with this suggestion.</small>' +
        "</label></div>";
    }).join("");

    $("#suggestionList").html(html);
  }

  function applySuggestions() {
    var parent = state.nodes[focusedId];
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
    renderMap(true);
    showToast("Suggestions added.");
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
    if (selectedDetailId) renderMap(false);
    selectedDetailId = null;
  }

  function updateSelectedDetail(key, value) {
    if (!selectedDetailId || !state.nodes[selectedDetailId]) return;

    state.nodes[selectedDetailId][key] = value;
    saveState();

    if (selectedDetailId === focusedId && key === "title") {
      $("#centerInput").val(value);
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

  function resetAll() {
    if (state.rootId && !window.confirm("Start a new map? Your current local map will be cleared.")) return;

    state = defaultState();
    focusedId = null;
    selectedDetailId = null;
    currentNextId = null;
    localStorage.removeItem(STORAGE_KEY);
    closeInspector();
    showFreshGoal();
    startPromptRotation();
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
    var light = !$("body").hasClass("light");
    $("body").toggleClass("light", light);
    localStorage.setItem(THEME_KEY, light ? "light" : "dark");
  }

  function applyStoredTheme() {
    $("body").toggleClass("light", localStorage.getItem(THEME_KEY) === "light");
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
