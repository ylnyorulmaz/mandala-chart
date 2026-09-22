(function ($) {
  "use strict";

  var STORAGE_KEY = "mandala-chart-state-v2";
  var LEGACY_STORAGE_KEY = "mandala-chart-state-v1";
  var THEME_KEY = "mandala-chart-theme-v1";

  var state = defaultState();
  var currentMapId = null;
  var currentMapCreatedAt = null;
  var storageReady = false;
  var stateSaveTimer = null;
  var snapshotTimer = null;
  var lastSnapshotAt = 0;
  var snapshotHistoryMapId = null;
  var relationshipMapId = null;

  var selectedId = null;
  var editingId = null;
  var selectedDetailId = null;
  var suggestionBuffer = [];
  var currentNextId = null;
  var toastTimer = null;
  var promptTimer = null;
  var promptSwapTimer = null;
  var promptIndex = 0;
  var initialRender = true;

  var camera = { x: 0, y: 0, scale: 1 };
  var panState = null;
  var nodeDragState = null;
  var cameraAnimationFrame = null;
  var cameraInputFrame = null;
  var pendingCamera = null;
  var suppressNodeClickId = null;
  var suppressNodeClickUntil = 0;
  var pointers = {};
  var pinchState = null;
  var renderPositions = {};
  var activeView = "map";

  var PROMPTS = [
    "achieve",
    "do",
    "finish"
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

  async function init() {
    applyStoredTheme();
    $("#year").text(new Date().getFullYear());
    bindGlobalEvents();

    if (!$("#mapViewport").length) return;

    bindPlannerEvents();
    await initializePlannerStorage();

    if (state.rootId && state.nodes[state.rootId]) {
      selectedId = state.rootId;
      normalizeState();
    }

    showEmptyMap();
    startPromptRotation();
    initialRender = false;

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        persistCurrentMapNow();
        createAutosaveSnapshot("Background autosave", false);
      }
    });

    window.addEventListener("pagehide", function () {
      persistCurrentMapNow();
    });

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  }

  function bindGlobalEvents() {
    $("#themeButton").on("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleThemePalette();
    });

    $("#themePalette").on("click", ".theme-choice", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setTheme($(this).data("theme"));
      closeThemePalette();
    });

    $(document).on("click", function (e) {
      if (!$(e.target).closest(".theme-picker").length) {
        closeThemePalette();
      }
    });

    $(document).on("keydown.themePalette", function (e) {
      if (e.key === "Escape") {
        closeThemePalette();
        return;
      }

      if (!$("#themePalette").is(":visible")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" &&
          e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

      e.preventDefault();
      var $choices = $("#themePalette .theme-choice");
      var current = Math.max($choices.index(document.activeElement), 0);
      var delta = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
      var next = (current + delta + $choices.length) % $choices.length;
      $choices.eq(next).focus();
    });

    $("#mapsButton").on("click", function () {
      openMapsModal();
    });

    $("#closeMapsModal").on("click", closeMapsModal);
    $("#backToMapsButton, #backFromRelationshipsButton").on("click", function () {
      showMapsLibraryPane();
      renderMapsLibrary();
    });

    $("#newMapButton").on("click", async function () {
      await createAutosaveSnapshot("Before new map", true);
      await persistCurrentMapNow();
      closeMapsModal();
      startNewMap(true);
    });

    $("#mapsList").on("click", ".map-open-button", function () {
      openStoredMap($(this).closest(".map-card").data("map-id"));
    });

    $("#mapsList").on("click", ".map-history-button", function () {
      openSnapshotHistory($(this).closest(".map-card").data("map-id"));
    });

    $("#mapsList").on("click", ".map-connect-button", function () {
      openMapRelationships($(this).closest(".map-card").data("map-id"));
    });

    $("#mapsList").on("click", ".map-delete-button", function () {
      deleteStoredMap($(this).closest(".map-card").data("map-id"));
    });

    $("#snapshotList").on("click", ".snapshot-restore-button", function () {
      restoreSnapshot($(this).closest(".snapshot-row").data("snapshot-id"));
    });

    $("#saveMapGroupButton").on("click", saveRelationshipMapGroup);
    $("#mapGroupInput").on("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        saveRelationshipMapGroup();
      }
    });

    $("#addMapRelationButton").on("click", addRelationshipFromEditor);

    $("#mapRelationsList").on("click", ".remove-map-link", function () {
      removeMapRelationship($(this).closest(".map-relation-row").data("link-id"));
    });

    $("#mapsModal").on("click", function (e) {
      if (e.target === this) closeMapsModal();
    });

    $("#continueButton").on("click", function () {
      if (!state.rootId || !state.nodes[state.rootId]) return;
      selectedId = selectedId || state.rootId;
      stopPromptRotation();
      showMap();
      renderAll(false);
      setTimeout(function () {
        fitAll(true);
      }, 30);
    });
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

    $("#mapNodes").on("click", ".node-complete", function (e) {
      e.preventDefault();
      e.stopPropagation();

      var id = $(this).closest(".map-node").data("id");
      toggleNodeDone(id, true);
    });

    $("#mapNodes").on("click", ".map-node", function (e) {
      if ($(e.target).is("textarea")) return;
      if (nodeDragState && nodeDragState.moved) return;

      var id = $(this).data("id");
      var node = state.nodes[id];
      if (!node) return;

      if (suppressNodeClickId === id && Date.now() < suppressNodeClickUntil) {
        suppressNodeClickId = null;
        suppressNodeClickUntil = 0;
        return;
      }

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
        showToast("Branch unlocked — add your next moves.");
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
      if ($(e.target).is("textarea, button") || $(e.target).closest("button").length) return;
      if (e.originalEvent && e.originalEvent.isPrimary === false) return;

      var id = $(this).data("id");
      var node = state.nodes[id];
      if (!node) return;

      e.preventDefault();
      e.stopPropagation();
      stopCameraMotion();

      nodeDragState = {
        id: id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        baseX: (node.offsetX || 0),
        baseY: (node.offsetY || 0),
        moved: false
      };

      try { this.setPointerCapture(e.pointerId); } catch (ignore) {}
    });

    $("#mapNodes").on("pointermove", ".map-node", function (e) {
      if (!nodeDragState ||
          nodeDragState.id !== $(this).data("id") ||
          nodeDragState.pointerId !== e.pointerId) return;

      var node = state.nodes[nodeDragState.id];
      if (!node) return;

      e.preventDefault();
      e.stopPropagation();

      var screenDx = e.clientX - nodeDragState.startX;
      var screenDy = e.clientY - nodeDragState.startY;

      if (Math.hypot(screenDx, screenDy) > 5) {
        nodeDragState.moved = true;
        $(this).addClass("dragging");
      }

      if (!nodeDragState.moved) return;

      var dx = screenDx / camera.scale;
      var dy = screenDy / camera.scale;
      node.offsetX = nodeDragState.baseX + dx;
      node.offsetY = nodeDragState.baseY + dy;

      var basePos = calculatePositionFromPath(getIndexPath(node.id));
      renderPositions[node.id] = withOffset(node, basePos);

      $('.map-node[data-id="' + node.id + '"]').css({
        left: renderPositions[node.id].x + "px",
        top: renderPositions[node.id].y + "px"
      });

      renderEdges(getVisibleNodeIds());
      renderMinimap();
    });

    $("#mapNodes").on("pointerup pointercancel", ".map-node", function (e) {
      if (!nodeDragState ||
          nodeDragState.id !== $(this).data("id") ||
          nodeDragState.pointerId !== e.pointerId) return;

      var moved = nodeDragState.moved;
      var id = nodeDragState.id;

      $(this).removeClass("dragging");
      try { this.releasePointerCapture(e.pointerId); } catch (ignore) {}

      if (moved) {
        selectedId = id;
        suppressNodeClickId = id;
        suppressNodeClickUntil = Date.now() + 350;
        saveState();
        updateSelectionBar();
        renderMinimap();
      }

      nodeDragState = null;
    });

    $("#mapViewport").on("pointerdown", function (e) {
      if ($(e.target).closest(".map-node, .map-toolbar, .minimap, .empty-map, .quest-progress, .canvas-status").length) return;

      stopCameraMotion();
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

      try { this.setPointerCapture(e.pointerId); } catch (ignore) {}

      if (Object.keys(pointers).length === 1) {
        panState = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          cameraX: camera.x,
          cameraY: camera.y,
          moved: false
        };
        $(this).addClass("grabbing");
      } else if (Object.keys(pointers).length === 2) {
        beginPinch();
      }
    });

    $("#mapViewport").on("pointermove", function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

      if (Object.keys(pointers).length === 2) {
        updatePinch();
        return;
      }

      if (!panState || panState.pointerId !== e.pointerId) return;

      var dx = e.clientX - panState.startX;
      var dy = e.clientY - panState.startY;
      if (!panState.moved && Math.hypot(dx, dy) > 3) panState.moved = true;

      scheduleCameraInput(
        panState.cameraX + dx,
        panState.cameraY + dy,
        camera.scale
      );
    });

    $("#mapViewport").on("pointerup pointercancel", function (e) {
      var wasTap = !!(panState &&
        panState.pointerId === e.pointerId &&
        !panState.moved &&
        e.type === "pointerup");

      delete pointers[e.pointerId];
      try { this.releasePointerCapture(e.pointerId); } catch (ignore) {}
      flushCameraInput();

      var remainingIds = Object.keys(pointers);

      if (remainingIds.length < 2) pinchState = null;

      if (remainingIds.length === 1) {
        var remainingId = remainingIds[0];
        var remaining = pointers[remainingId];
        panState = {
          pointerId: Number(remainingId),
          startX: remaining.x,
          startY: remaining.y,
          cameraX: camera.x,
          cameraY: camera.y,
          moved: true
        };
      } else if (remainingIds.length === 0) {
        panState = null;
        $(this).removeClass("grabbing");
      }

      if (wasTap) clearMapSelection();
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
    $("#reviewButton").on("click", openReviewModal);
    $("#exportButton").on("click", exportState);
    $("#resetButton").on("click", resetAll);

    $("#mapViewButton").on("click", function () {
      switchView("map");
    });

    $("#tableViewButton").on("click", function () {
      switchView("table");
    });

    $("#gridViewButton").on("click", function () {
      switchView("grid");
    });

    $("#mandalaGrid").on("click", ".mandala-grid-cell[data-node-id]", function () {
      var id = $(this).data("node-id");
      if (!id || !state.nodes[id]) return;

      selectedId = id;
      editingId = null;
      $("#mandalaGrid .mandala-grid-cell").removeClass("selected");
      $('#mandalaGrid .mandala-grid-cell[data-node-id="' + id + '"]').addClass("selected");
      $(this).focus();
    });

    $("#mandalaGrid").on("click", ".mandala-grid-cell[data-parent-id]:not([data-node-id])", function (e) {
      e.preventDefault();
      var id = ensureGridActionSlot($(this).data("parent-id"), parseInt($(this).data("slot-index"), 10));
      if (!id || !state.nodes[id]) return;
      selectedId = id;
      renderGrid();
      openInspector(id);
    });

    $("#mandalaGrid").on("dblclick", ".mandala-grid-cell", function (e) {
      e.preventDefault();
      var id = $(this).data("node-id");

      if (!id) {
        id = ensureGridActionSlot($(this).data("parent-id"), parseInt($(this).data("slot-index"), 10));
      }

      if (!id || !state.nodes[id]) return;
      selectedId = id;
      renderGrid();
      openInspector(id);
    });

    $("#mandalaGrid").on("keydown", ".mandala-grid-cell", function (e) {
      if (isArrowKey(e.key)) {
        e.preventDefault();
        moveGridFocus($(this), e.key);
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        var id = $(this).data("node-id");

        if (!id) {
          id = ensureGridActionSlot($(this).data("parent-id"), parseInt($(this).data("slot-index"), 10));
        }

        if (!id || !state.nodes[id]) return;
        selectedId = id;
        renderGrid();
        openInspector(id);
      }
    });

    $("#nodeTableBody").on("click", ".table-expand-button", function () {
      var id = $(this).closest("tr").data("id");
      var node = state.nodes[id];
      if (!node || !node.children || !node.children.length) return;

      node.tableCollapsed = !node.tableCollapsed;
      saveState();
      renderTable();
    });

    $("#nodeTableBody").on("change", ".table-done-input", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      var nextStatus = this.checked ? "done" : "open";
      setNodeStatus(id, nextStatus, this.checked);
    });

    $("#nodeTableBody").on("input", ".table-title-input", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      state.nodes[id].title = $(this).val();
      saveState();
    });

    $("#nodeTableBody").on("keydown", ".table-title-input", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        $(this).blur();
      }
    });

    $("#nodeTableBody").on("blur", ".table-title-input", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      state.nodes[id].title = $(this).val().trim();
      saveState();
      renderTable();
    });

    $("#nodeTableBody").on("change", ".table-status-select", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      var wasDone = state.nodes[id].status === "done";
      var status = $(this).val();
      state.nodes[id].status = status;
      saveState();
      renderAll(false);
      if (!wasDone && status === "done") celebrateNode(state.nodes[id]);
    });

    $("#nodeTableBody").on("change", ".table-decision-select", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      state.nodes[id].decision = $(this).val();
      saveState();
      renderAll(false);
    });

    $("#nodeTableBody").on("change", ".table-impact-select, .table-effort-select", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      var node = state.nodes[id];
      node.impact = parseInt($(this).closest("tr").find(".table-impact-select").val(), 10);
      node.effort = parseInt($(this).closest("tr").find(".table-effort-select").val(), 10);
      saveState();
      renderAll(false);
    });

    $("#nodeTableBody").on("click", ".table-focus-button", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      revealNodePath(id);
      selectedId = id;
      switchView("map");
      renderAll(false);
      setTimeout(function () {
        focusCameraOnNode(id, Math.max(camera.scale, nodeFocusScale(state.nodes[id])));
      }, 30);
    });

    $("#nodeTableBody").on("click", ".table-details-button", function () {
      var id = $(this).closest("tr").data("id");
      if (!id || !state.nodes[id]) return;
      selectedId = id;
      openInspector(id);
    });

    $("#markDoneButton").on("click", function () {
      toggleNodeDone(selectedId, true);
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

    $("#closeReviewModal, #closeReviewButton").on("click", function () {
      $("#reviewModal").attr("hidden", true);
    });

    $("#openTriageTableButton").on("click", function () {
      $("#reviewModal").attr("hidden", true);
      switchView("table");
    });

    $("#openNextAction").on("click", function () {
      if (!currentNextId) return;
      $("#nextModal").attr("hidden", true);
      selectNode(currentNextId, true);
      focusCameraOnNode(currentNextId, 1.12);
    });

    $("#completeNextAction").on("click", function () {
      if (!currentNextId || !state.nodes[currentNextId]) return;
      setNodeStatus(currentNextId, "done", true);
      setTimeout(openNextModal, 420);
    });

    $("#suggestionModal, #nextModal, #reviewModal").on("click", function (e) {
      if (e.target === this) $(this).attr("hidden", true);
    });

    $("#closeInspector").on("click", closeInspector);

    $("#detailTitle").on("input", function () {
      updateSelectedDetail("title", $(this).val());
    });

    $("#impactInput, #effortInput").on("input", function () {
      if (!selectedDetailId || !state.nodes[selectedDetailId]) return;
      var node = state.nodes[selectedDetailId];
      node.impact = parseInt($("#impactInput").val(), 10);
      node.effort = parseInt($("#effortInput").val(), 10);
      $("#impactOutput").text(node.impact);
      $("#effortOutput").text(node.effort);
      updatePriorityCard(node);
      saveState();
    });

    $("#decisionInput").on("change", function () {
      updateSelectedDetail("decision", $(this).val());
      syncDecisionFields($(this).val());
      if (selectedDetailId && state.nodes[selectedDetailId]) {
        updatePriorityCard(state.nodes[selectedDetailId]);
        renderAll(false);
      }
    });

    $("#dependencyInput").on("change", function () {
      updateSelectedDetail("dependencyId", $(this).val() || null);
      if (selectedDetailId && state.nodes[selectedDetailId]) {
        updatePriorityCard(state.nodes[selectedDetailId]);
        renderAll(false);
      }
    });

    $("#delegatedToInput").on("input", function () {
      updateSelectedDetail("delegatedTo", $(this).val());
    });

    $("#deferUntilInput").on("change", function () {
      updateSelectedDetail("deferUntil", $(this).val());
    });

    $("#durationInput").on("input", function () {
      updateSelectedDetail("duration", $(this).val());
    });

    $("#statusInput").on("change", function () {
      if (!selectedDetailId || !state.nodes[selectedDetailId]) return;
      var nextStatus = $(this).val();
      var wasDone = state.nodes[selectedDetailId].status === "done";
      state.nodes[selectedDetailId].status = nextStatus;
      saveState();
      renderAll(false);

      if (!wasDone && nextStatus === "done") {
        celebrateNode(state.nodes[selectedDetailId]);
      }
    });

    $("#notesInput").on("input", function () {
      updateSelectedDetail("notes", $(this).val());
    });

    $("#deleteNodeButton").on("click", clearSelectedNode);

    $(window).on("resize", debounce(function () {
      if (activeView === "grid" && !gridViewAvailable()) {
        activeView = "map";
      }
      renderAll(false);
      if (initialRender && activeView === "map") fitAll(false);
    }, 100));

    $(window).on("orientationchange", function () {
      setTimeout(function () {
        if (!state.rootId || activeView !== "map") return;
        renderAll(false);
        if (selectedId && renderPositions[selectedId]) {
          focusCameraOnNode(selectedId, Math.min(camera.scale, 1.05));
        } else {
          fitAll(false);
        }
      }, 180);
    });

    $(document).on("keydown", function (e) {
      if (e.key === "Escape") {
        closeInspector();
        $("#suggestionModal, #nextModal, #reviewModal, #mapsModal").attr("hidden", true);
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

      if (isKeyboardTypingTarget(e.target)) return;

      if (activeView === "map" && isArrowKey(e.key) && !isPlannerOverlayOpen()) {
        e.preventDefault();

        if (e.shiftKey) {
          panMapByArrow(e.key);
        } else {
          navigateMapByArrow(e.key);
        }
        return;
      }

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
    });
  }

  function defaultState() {
    return {
      rootId: null,
      nodes: {},
      version: 5
    };
  }

  function mapUid() {
    return "map_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  function cloneState(value) {
    return JSON.parse(JSON.stringify(value || defaultState()));
  }

  function currentMapTitle(sourceState) {
    var target = sourceState || state;
    var root = target.rootId && target.nodes ? target.nodes[target.rootId] : null;
    return root && root.title && root.title.trim() ? root.title.trim() : "Untitled map";
  }

  function loadLegacyState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return defaultState();

      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.nodes) return defaultState();
      parsed.version = 5;
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  async function initializePlannerStorage() {
    try {
      if (!window.MandalaStorage) throw new Error("MandalaStorage unavailable");
      await window.MandalaStorage.init();
      storageReady = true;

      var maps = await window.MandalaStorage.listMaps();

      if (!maps.length) {
        var legacy = loadLegacyState();

        if (legacy.rootId && legacy.nodes[legacy.rootId]) {
          currentMapId = mapUid();
          currentMapCreatedAt = Date.now();
          state = legacy;

          await window.MandalaStorage.saveMap({
            id: currentMapId,
            title: currentMapTitle(legacy),
            createdAt: currentMapCreatedAt,
            updatedAt: Date.now(),
            state: cloneState(legacy)
          });
          await window.MandalaStorage.setActiveMapId(currentMapId);
          await window.MandalaStorage.createSnapshot(
            currentMapId,
            currentMapTitle(legacy),
            cloneState(legacy),
            "Migrated from localStorage"
          );

          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          lastSnapshotAt = Date.now();
          return;
        }

        state = defaultState();
        return;
      }

      var activeId = await window.MandalaStorage.getActiveMapId();
      var activeRecord = activeId ? await window.MandalaStorage.getMap(activeId) : null;

      if (!activeRecord) {
        activeRecord = maps[0];
        activeId = activeRecord.id;
        await window.MandalaStorage.setActiveMapId(activeId);
      }

      currentMapId = activeId;
      currentMapCreatedAt = activeRecord.createdAt || Date.now();
      state = activeRecord.state && activeRecord.state.nodes
        ? cloneState(activeRecord.state)
        : defaultState();
      state.version = 5;

      var latestSnapshot = (await window.MandalaStorage.listSnapshots(currentMapId, 1))[0];
      lastSnapshotAt = latestSnapshot ? (latestSnapshot.createdAt || 0) : 0;
    } catch (error) {
      storageReady = false;
      currentMapId = null;
      currentMapCreatedAt = null;
      state = loadLegacyState();
      setTimeout(function () {
        showToast("Local database unavailable — using single-map fallback.");
      }, 0);
    }
  }

  function normalizeState() {
    Object.keys(state.nodes).forEach(function (id) {
      var node = state.nodes[id];
      if (!node.children) node.children = [];
      if (typeof node.collapsed !== "boolean") node.collapsed = false;
      if (typeof node.tableCollapsed !== "boolean") node.tableCollapsed = false;
      if (typeof node.offsetX !== "number") node.offsetX = 0;
      if (typeof node.offsetY !== "number") node.offsetY = 0;
      if (!node.status) node.status = "open";
      if (!node.impact) node.impact = 3;
      if (!node.effort) node.effort = 3;
      if (["do", "defer", "delegate", "delete"].indexOf(node.decision) === -1) node.decision = "do";
      if (typeof node.delegatedTo !== "string") node.delegatedTo = "";
      if (typeof node.deferUntil !== "string") node.deferUntil = "";
      if (node.dependencyId && !state.nodes[node.dependencyId]) node.dependencyId = null;
      if (typeof node.dependencyId === "undefined") node.dependencyId = null;
    });
    state.version = 5;
    saveState();
  }

  function saveState() {
    state.version = 5;

    if (!storageReady) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return;
    }

    if (!state.rootId || !state.nodes[state.rootId]) return;

    if (!currentMapId) {
      currentMapId = mapUid();
      currentMapCreatedAt = Date.now();
      window.MandalaStorage.setActiveMapId(currentMapId).catch(function () {});
    }

    clearTimeout(stateSaveTimer);
    stateSaveTimer = setTimeout(function () {
      persistCurrentMapNow();
    }, 220);

    scheduleAutosaveSnapshot();
  }

  async function persistCurrentMapNow() {
    clearTimeout(stateSaveTimer);
    stateSaveTimer = null;

    if (!storageReady || !currentMapId || !state.rootId || !state.nodes[state.rootId]) return;

    try {
      var now = Date.now();
      var snapshot = cloneState(state);

      await window.MandalaStorage.saveMap({
        id: currentMapId,
        title: currentMapTitle(snapshot),
        createdAt: currentMapCreatedAt || now,
        updatedAt: now,
        state: snapshot
      });
    } catch (error) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  function scheduleAutosaveSnapshot() {
    if (!storageReady || !currentMapId || !state.rootId) return;

    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(function () {
      createAutosaveSnapshot();
    }, 3500);
  }

  async function createAutosaveSnapshot(reason, force) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;

    if (!storageReady || !currentMapId || !state.rootId || !state.nodes[state.rootId]) return null;

    var now = Date.now();
    var minimumGap = 30000;

    if (!force && lastSnapshotAt && now - lastSnapshotAt < minimumGap) {
      snapshotTimer = setTimeout(function () {
        createAutosaveSnapshot(reason, false);
      }, minimumGap - (now - lastSnapshotAt) + 100);
      return null;
    }

    try {
      await persistCurrentMapNow();
      var created = await window.MandalaStorage.createSnapshot(
        currentMapId,
        currentMapTitle(),
        cloneState(state),
        reason || "Autosave"
      );

      if (created) lastSnapshotAt = created.createdAt || Date.now();
      return created;
    } catch (error) {
      return null;
    }
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
      decision: "do",
      dependencyId: null,
      delegatedTo: "",
      deferUntil: "",
      duration: "",
      notes: "",
      collapsed: false,
      tableCollapsed: false,
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
    $("body").addClass("empty-start");
    $("#continueButton").attr("hidden", !(state.rootId && state.nodes[state.rootId]));
    $("#plannerActions, #viewSwitcher, #selectionBar, #minimap, #tableView, #gridView").attr("hidden", true);
    $("#mapViewport").removeAttr("hidden");
    $("#emptyMap").removeAttr("hidden");
    $("#mapNodes, #mapEdges, #minimapWorld").empty();
    $("#rootInput").attr("hidden", true).val("");
    $("#starterCopy").removeAttr("hidden");
    camera = { x: viewportWidth() / 2, y: viewportHeight() / 2, scale: 1 };
    applyCamera();
  }

  function showMap() {
    $("body").removeClass("empty-start");
    $("#continueButton").attr("hidden", true);
    $("#emptyMap").attr("hidden", true);
    $("#plannerActions, #viewSwitcher").removeAttr("hidden");
    applyActiveView();
  }

  function gridViewAvailable() {
    return window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;
  }

  function switchView(view) {
    if (["map", "table", "grid"].indexOf(view) === -1) return;
    if (!state.rootId || !state.nodes[state.rootId]) return;
    if (view === "grid" && !gridViewAvailable()) return;

    activeView = view;
    applyActiveView();

    if (view === "table") {
      renderTable();
    } else if (view === "grid") {
      renderGrid();
    } else {
      renderAll(false);
      setTimeout(function () {
        applyCamera();
      }, 20);
    }
  }

  function applyActiveView() {
    if (activeView === "grid" && !gridViewAvailable()) {
      activeView = "map";
    }

    var mapMode = activeView === "map";
    var tableMode = activeView === "table";
    var gridMode = activeView === "grid";

    $("#mapViewButton")
      .toggleClass("active", mapMode)
      .attr("aria-pressed", mapMode ? "true" : "false");

    $("#tableViewButton")
      .toggleClass("active", tableMode)
      .attr("aria-pressed", tableMode ? "true" : "false");

    $("#gridViewButton")
      .toggleClass("active", gridMode)
      .attr("aria-pressed", gridMode ? "true" : "false");

    $("#mapViewport").attr("hidden", !mapMode);
    $("#tableView").attr("hidden", !tableMode);
    $("#gridView").attr("hidden", !gridMode);

    if (mapMode) {
      $("#minimap").removeAttr("hidden");
      updateSelectionBar();
    } else {
      $("#selectionBar, #minimap").attr("hidden", true);
    }
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
    currentMapId = mapUid();
    currentMapCreatedAt = Date.now();
    lastSnapshotAt = 0;

    var root = createNode(value, null, 0);
    state.rootId = root.id;
    selectedId = root.id;
    createEightSlots(root.id);

    if (storageReady) {
      window.MandalaStorage.setActiveMapId(currentMapId).catch(function () {});
    }

    saveState();

    showMap();
    renderAll(true);
    fitAll(true);
    showToast("Intention set. Eight directions unlocked.");
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
    renderTable();
    renderGrid();
    updateSelectionBar();
    renderMinimap();
    updateCanvasStatus();
    updateQuestProgress();
    applyCamera();
    applyActiveView();

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

  function renderTable() {
    if (!state.rootId || !state.nodes[state.rootId]) {
      $("#nodeTableBody, #triageSummary").empty();
      return;
    }

    var ids = getTableNodeIds();
    var html = "";

    ids.forEach(function (id) {
      var node = state.nodes[id];
      if (!node) return;

      var title = node.title.trim();
      var placeholder = placeholderText(node);
      var done = node.status === "done";
      var estimate = node.duration ? escapeHtml(String(node.duration)) + " min" : "—";
      var hasChildren = !!(node.children && node.children.length);
      var canExpand = hasChildren && node.depth >= 1;
      var collapsed = canExpand && node.tableCollapsed;
      var childCount = hasChildren ? node.children.length : 0;
      var decision = decisionValue(node);
      var blocked = isNodeBlocked(node);
      var dependencyText = dependencyStateLabel(node);
      var rowClasses = [
        done ? "table-row-done" : "",
        !title ? "table-row-placeholder" : "",
        node.depth === 1 ? "table-driver-row" : "",
        canExpand ? "table-expandable-row" : "",
        collapsed ? "table-row-collapsed" : "",
        "table-decision-" + decision,
        blocked ? "table-row-blocked" : ""
      ].filter(Boolean).join(" ");

      html += '<tr class="' + rowClasses + '" data-id="' + id + '">' +
        '<td class="done-col" data-label="Done"><label class="table-check" aria-label="' +
          escapeHtml(done ? "Mark open" : "Mark done") + '">' +
          '<input class="table-done-input" type="checkbox"' +
            (done ? " checked" : "") + ((!title || decision === "delete") ? " disabled" : "") + '>' +
          '<span>✓</span></label></td>' +
        '<td class="node-col" data-label="Node"><div class="table-node-cell" style="--depth:' + Math.min(node.depth || 0, 4) + '">' +
          (canExpand
            ? '<button class="table-expand-button" type="button" aria-expanded="' +
                (collapsed ? "false" : "true") + '" aria-label="' +
                escapeHtml(collapsed ? "Expand row" : "Collapse row") + '" title="' +
                escapeHtml(collapsed ? "Expand" : "Collapse") + '">' +
                '<span class="table-expand-chevron">›</span>' +
                '<span class="table-child-count">' + childCount + '</span>' +
              '</button>'
            : '<span class="table-expand-spacer" aria-hidden="true"></span>') +
          '<span class="table-tree-dot depth-' + Math.min(node.depth || 0, 3) + '"></span>' +
          '<input class="table-title-input" type="text" maxlength="180" value="' +
            escapeHtml(node.title || "") + '" placeholder="' + escapeHtml(placeholder) + '">' +
        '</div></td>' +
        '<td data-label="Kind"><span class="table-kind kind-' + Math.min(node.depth || 0, 3) + '">' +
          escapeHtml(typeLabel(node).toLowerCase()) + '</span></td>' +
        '<td data-label="Decision"><select class="table-decision-select decision-' + decision + '" aria-label="Decision">' +
          decisionOptions(decision) +
        '</select></td>' +
        '<td data-label="Impact"><select class="table-score-select table-impact-select" aria-label="Impact">' +
          scoreOptions(node.impact || 3) + '</select></td>' +
        '<td data-label="Effort"><select class="table-score-select table-effort-select" aria-label="Effort">' +
          scoreOptions(node.effort || 3) + '</select></td>' +
        '<td data-label="Ready"><span class="readiness-pill ' + (blocked ? "blocked" : "ready") + '" title="' +
          escapeHtml(dependencyText) + '">' + escapeHtml(blocked ? "Blocked" : "Ready") + '</span></td>' +
        '<td data-label="Status"><select class="table-status-select" aria-label="Status">' +
          '<option value="open"' + (node.status === "open" ? " selected" : "") + '>Open</option>' +
          '<option value="doing"' + (node.status === "doing" ? " selected" : "") + '>Doing</option>' +
          '<option value="done"' + (node.status === "done" ? " selected" : "") + '>Done</option>' +
        '</select></td>' +
        '<td class="table-time" data-label="Time">' + estimate + '</td>' +
        '<td class="table-row-actions" data-label="Actions">' +
          '<button class="table-icon-button table-details-button" type="button" title="Decide & details" aria-label="Open decision and details">•••</button>' +
          '<button class="table-icon-button table-focus-button" type="button" title="Show on map" aria-label="Show on map">↗</button>' +
        '</td>' +
      '</tr>';
    });

    $("#nodeTableBody").html(html);
    renderTriageSummary();
  }

  function renderGrid() {
    if (!state.rootId || !state.nodes[state.rootId]) {
      $("#mandalaGrid").empty();
      return;
    }

    var root = state.nodes[state.rootId];
    var directions = mandalaDirections();
    var cells = new Array(81).fill(null);

    function put(row, col, descriptor) {
      if (row < 0 || row > 8 || col < 0 || col > 8) return;
      cells[row * 9 + col] = descriptor;
    }

    // The center 3x3: goal in the middle, eight drivers around it.
    put(4, 4, {
      nodeId: root.id,
      kind: "goal",
      driverIndex: -1,
      canonical: true
    });

    directions.forEach(function (point, driverIndex) {
      var driverId = root.children && root.children[driverIndex];
      var driver = driverId ? state.nodes[driverId] : null;

      put(3 + point.row, 3 + point.col, {
        nodeId: driver ? driver.id : null,
        kind: "driver-reference",
        driverIndex: driverIndex,
        canonical: true
      });

      // Each surrounding 3x3 block repeats its driver in the center.
      var blockRow = point.row * 3;
      var blockCol = point.col * 3;

      for (var localRow = 0; localRow < 3; localRow++) {
        for (var localCol = 0; localCol < 3; localCol++) {
          put(blockRow + localRow, blockCol + localCol, {
            nodeId: null,
            kind: "action-empty",
            driverIndex: driverIndex,
            parentId: driver ? driver.id : null,
            slotIndex: mandalaSlotIndex(localRow, localCol)
          });
        }
      }

      put(blockRow + 1, blockCol + 1, {
        nodeId: driver ? driver.id : null,
        kind: "driver-anchor",
        driverIndex: driverIndex,
        canonical: false
      });

      if (!driver) return;

      directions.forEach(function (actionPoint, actionIndex) {
        var actionId = driver.children && driver.children[actionIndex];
        var action = actionId ? state.nodes[actionId] : null;

        put(blockRow + actionPoint.row, blockCol + actionPoint.col, {
          nodeId: action ? action.id : null,
          kind: action ? "action" : "action-empty",
          driverIndex: driverIndex,
          parentId: driver.id,
          slotIndex: actionIndex
        });
      });
    });

    var html = "";

    cells.forEach(function (descriptor, index) {
      var row = Math.floor(index / 9);
      var col = index % 9;
      descriptor = descriptor || { kind: "blank", driverIndex: -1 };

      var node = descriptor.nodeId ? state.nodes[descriptor.nodeId] : null;
      var title = node && node.title ? node.title.trim() : "";
      var done = !!(node && node.status === "done");
      var decision = node ? decisionValue(node) : "do";
      var blocked = !!(node && isNodeBlocked(node));
      var descendantCount = node && node.depth >= 2 ? countDescendants(node.id) : 0;
      var selected = !!(node && selectedId === node.id);
      var classes = [
        "mandala-grid-cell",
        "grid-kind-" + descriptor.kind,
        descriptor.driverIndex >= 0 ? "grid-driver-" + descriptor.driverIndex : "",
        row % 3 === 0 ? "block-top" : "",
        col % 3 === 0 ? "block-left" : "",
        row % 3 === 2 ? "block-bottom" : "",
        col % 3 === 2 ? "block-right" : "",
        done ? "grid-done" : "",
        decision === "delete" ? "grid-dropped" : "",
        blocked ? "grid-blocked" : "",
        selected ? "selected" : "",
        !title ? "grid-untitled" : ""
      ].filter(Boolean).join(" ");

      var displayTitle = title;
      if (!displayTitle && descriptor.kind.indexOf("driver") === 0) displayTitle = "Driver";
      if (!displayTitle && descriptor.kind === "goal") displayTitle = "Goal";

      var data = ' data-row="' + row + '" data-col="' + col + '"';
      if (node) data += ' data-node-id="' + node.id + '"';
      if (descriptor.parentId) data += ' data-parent-id="' + descriptor.parentId + '"';
      if (typeof descriptor.slotIndex === "number" && descriptor.slotIndex >= 0) {
        data += ' data-slot-index="' + descriptor.slotIndex + '"';
      }

      var canCreate = !node && descriptor.kind === "action-empty" && descriptor.parentId &&
        typeof descriptor.slotIndex === "number" && descriptor.slotIndex >= 0;

      var tabIndex = descriptor.kind === "goal" || selected ? "0" : "-1";
      var aria = displayTitle ||
        (canCreate ? "Empty action slot" : "Empty Mandala cell");

      html += '<button class="' + classes + '" type="button" role="gridcell" tabindex="' + tabIndex + '"' +
        ' aria-rowindex="' + (row + 1) + '" aria-colindex="' + (col + 1) + '"' +
        ' aria-label="' + escapeHtml(aria) + '"' + data +
        (node ? ' title="' + escapeHtml((displayTitle || placeholderText(node)) + " · double-click to inspect") + '"' :
          (canCreate ? ' title="Double-click to add an action"' : ' disabled')) + '>';

      if (node && done) html += '<span class="grid-state-mark" aria-hidden="true">✓</span>';
      if (node && blocked) html += '<span class="grid-blocked-mark" aria-hidden="true">•</span>';
      if (displayTitle) html += '<span class="grid-cell-title">' + escapeHtml(displayTitle) + '</span>';
      if (canCreate) html += '<span class="grid-empty-plus" aria-hidden="true">+</span>';
      if (descendantCount) html += '<span class="grid-more" title="Has smaller steps">+' + descendantCount + '</span>';

      html += '</button>';
    });

    $("#mandalaGrid").html(html);
  }

  function mandalaDirections() {
    // Clockwise from north, matching the Map view's driver order.
    return [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: 0 }
    ];
  }

  function mandalaSlotIndex(localRow, localCol) {
    var directions = mandalaDirections();

    for (var i = 0; i < directions.length; i++) {
      if (directions[i].row === localRow && directions[i].col === localCol) return i;
    }

    return -1;
  }

  function ensureGridActionSlot(parentId, slotIndex) {
    if (!parentId || !state.nodes[parentId] || slotIndex < 0 || slotIndex > 7) return null;

    var parent = state.nodes[parentId];
    if (!parent.children.length) createEightSlots(parentId);

    var childId = parent.children[slotIndex];
    if (!childId || !state.nodes[childId]) return null;

    selectedId = childId;
    saveState();
    renderAll(false);
    return childId;
  }

  function moveGridFocus($cell, key) {
    var row = parseInt($cell.attr("data-row"), 10);
    var col = parseInt($cell.attr("data-col"), 10);
    if (isNaN(row) || isNaN(col)) return;

    if (key === "ArrowUp") row -= 1;
    if (key === "ArrowDown") row += 1;
    if (key === "ArrowLeft") col -= 1;
    if (key === "ArrowRight") col += 1;

    row = clamp(row, 0, 8);
    col = clamp(col, 0, 8);

    var $next = $('#mandalaGrid .mandala-grid-cell[data-row="' + row + '"][data-col="' + col + '"]');
    if (!$next.length) return;

    $next.focus();

    var id = $next.data("node-id");
    if (id && state.nodes[id]) {
      selectedId = id;
      $("#mandalaGrid .mandala-grid-cell").removeClass("selected");
      $('#mandalaGrid .mandala-grid-cell[data-node-id="' + id + '"]').addClass("selected");
    }
  }

  function getTableNodeIds() {
    var result = [];

    function walk(id) {
      var node = state.nodes[id];
      if (!node) return;

      result.push(id);

      if (node.tableCollapsed && node.depth >= 1) return;

      (node.children || []).forEach(function (childId) {
        if (state.nodes[childId]) walk(childId);
      });
    }

    walk(state.rootId);
    return result;
  }

  function revealNodePath(id) {
    var node = state.nodes[id];

    while (node && node.parentId) {
      var parent = state.nodes[node.parentId];
      if (!parent) break;
      parent.collapsed = false;
      node = parent;
    }

    saveState();
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
    var sectorStep = deg(5.65);
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
        "decision-" + decisionValue(node),
        isNodeBlocked(node) ? "blocked" : "",
        node.collapsed && node.children.length ? "collapsed" : "",
        animateNew && node.depth > 0 ? "node-enter" : ""
      ].filter(Boolean).join(" ");

      var hiddenCount = countDescendants(id);
      var label = node.title.trim() || placeholderText(node);
      var editing = editingId === id;

      html += '<div class="' + classes + '" data-id="' + id + '" data-hidden-count="+' + hiddenCount + '"' +
        ' role="button" tabindex="-1" aria-label="' + escapeHtml(label) + '"' +
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
        if (decisionValue(node) !== "delete") {
          html += '<button class="node-complete" type="button" aria-label="' +
            (node.status === "done" ? "Mark open" : "Mark done") + '" title="' +
            (node.status === "done" ? "Mark open" : "Mark done") + '">' +
            (node.status === "done" ? "✓" : "") + "</button>";
        }

        html += '<span class="node-badge">' + typeLabel(node) +
          (node.status === "done" ? " · DONE" : "") + "</span>" +
          '<span class="node-decision-badge decision-' + decisionValue(node) + '">' +
          escapeHtml(decisionLabel(decisionValue(node))) + '</span>';
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
      showToast("Branch is back.");
      return;
    }

    createEightSlots(selectedId);
    renderAll(true);
    focusCameraOnNode(selectedId, nodeFocusScale(node));
    showToast("New branch unlocked.");
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
    if (activeView !== "map") {
      $("#selectionBar").attr("hidden", true);
      return;
    }

    var node = state.nodes[selectedId];
    if (!node) {
      $("#selectionBar").attr("hidden", true);
      return;
    }

    $("#selectionBar").removeAttr("hidden");
    $("#selectionType").text(typeLabel(node) + " · " + decisionLabel(decisionValue(node)).toUpperCase());
    $("#selectionTitle").text(node.title.trim() || placeholderText(node));
    $("#markDoneButton").text(node.status === "done" ? "Undo" : "Clear it ✓");
    $("#collapseButton").text(node.collapsed ? "Show branch" : "Hide branch");
    $("#collapseButton").prop("disabled", !node.children.length).css("opacity", node.children.length ? 1 : .45);
  }

  function typeLabel(node) {
    return LABELS[Math.min(node.depth || 0, 3)] || "STEP";
  }

  function focusCameraOnNode(id, targetScale, duration) {
    var pos = renderPositions[id];
    if (!pos) return;

    var scale = clamp(targetScale || camera.scale, minimumCameraScale(), 2.2);
    var x = viewportWidth() / 2 - pos.x * scale;
    var y = viewportHeight() / 2 - pos.y * scale;
    animateCameraTo(x, y, scale, duration || 360);
  }

  function fitAll(animated) {
    if (!state.rootId) return;

    var bounds = getWorldBounds();
    if (!bounds) return;

    var vw = viewportWidth();
    var vh = viewportHeight();
    var pad = isCompactViewport() ? Math.max(18, Math.min(vw, vh) * .06) : Math.min(vw, vh) * .13 + 60;
    var scaleX = (vw - pad * 2) / Math.max(bounds.width, 1);
    var scaleY = (vh - pad * 2) / Math.max(bounds.height, 1);
    var scale = clamp(Math.min(scaleX, scaleY), minimumCameraScale(), 1.08);

    var centerX = bounds.minX + bounds.width / 2;
    var centerY = bounds.minY + bounds.height / 2;
    var x = vw / 2 - centerX * scale;
    var y = vh / 2 - centerY * scale;

    if (animated) animateCameraTo(x, y, scale, 360);
    else {
      stopCameraMotion();
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
    if (depth === 2) return 43;
    return 36;
  }

  function applyCamera() {
    $("#mapWorld").css("transform", "translate(" + camera.x + "px," + camera.y + "px) scale(" + camera.scale + ")");
    $("#zoomReadout").text(Math.round(camera.scale * 100) + "%");
    renderMinimapCamera();
  }

  function stopCameraAnimation() {
    if (cameraAnimationFrame !== null) {
      cancelAnimationFrame(cameraAnimationFrame);
      cameraAnimationFrame = null;
    }
  }

  function cancelCameraInputFrame() {
    if (cameraInputFrame !== null) {
      cancelAnimationFrame(cameraInputFrame);
      cameraInputFrame = null;
    }
    pendingCamera = null;
  }

  function flushCameraInput() {
    if (cameraInputFrame !== null) {
      cancelAnimationFrame(cameraInputFrame);
      cameraInputFrame = null;
    }

    if (!pendingCamera) return;

    camera.x = pendingCamera.x;
    camera.y = pendingCamera.y;
    camera.scale = pendingCamera.scale;
    pendingCamera = null;
    applyCamera();
  }

  function stopCameraMotion() {
    stopCameraAnimation();
    cancelCameraInputFrame();
  }

  function scheduleCameraInput(x, y, scale) {
    pendingCamera = {
      x: x,
      y: y,
      scale: clamp(scale, minimumCameraScale(), 2.2)
    };

    if (cameraInputFrame !== null) return;

    cameraInputFrame = requestAnimationFrame(function () {
      cameraInputFrame = null;
      if (!pendingCamera) return;

      camera.x = pendingCamera.x;
      camera.y = pendingCamera.y;
      camera.scale = pendingCamera.scale;
      pendingCamera = null;
      applyCamera();
    });
  }

  function animateCameraTo(x, y, scale, duration) {
    stopCameraMotion();

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

      if (t < 1) {
        cameraAnimationFrame = requestAnimationFrame(frame);
      } else {
        cameraAnimationFrame = null;
      }
    }

    cameraAnimationFrame = requestAnimationFrame(frame);
  }

  function zoomAt(screenX, screenY, targetScale) {
    if (!state.rootId) return;

    stopCameraMotion();

    var newScale = clamp(targetScale, minimumCameraScale(), 2.2);
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

    stopCameraMotion();

    var center = midpoint(pts[0], pts[1]);
    var rect = document.getElementById("mapViewport").getBoundingClientRect();
    var sx = center.x - rect.left;
    var sy = center.y - rect.top;

    pinchState = {
      distance: Math.max(distance(pts[0], pts[1]), 1),
      scale: camera.scale,
      worldX: (sx - camera.x) / camera.scale,
      worldY: (sy - camera.y) / camera.scale
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
    var scale = clamp(
      pinchState.scale * (dist / pinchState.distance),
      minimumCameraScale(),
      2.2
    );

    scheduleCameraInput(
      sx - pinchState.worldX * scale,
      sy - pinchState.worldY * scale,
      scale
    );
  }

  function renderMinimap() {
    if (isCompactViewport()) {
      $("#minimap").attr("hidden", true);
      return;
    }

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

  function isCompactViewport() {
    return window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
  }

  function minimumCameraScale() {
    return isCompactViewport() ? .14 : .24;
  }

  function viewportWidth() {
    return $("#mapViewport").innerWidth() || 1000;
  }

  function viewportHeight() {
    return $("#mapViewport").innerHeight() || 650;
  }

  function toggleNodeDone(id, celebrate) {
    if (!id || !state.nodes[id] || !state.nodes[id].title.trim()) return;

    var node = state.nodes[id];
    var nextStatus = node.status === "done" ? "open" : "done";
    setNodeStatus(id, nextStatus, celebrate && nextStatus === "done");
  }

  function setNodeStatus(id, status, celebrate) {
    var node = state.nodes[id];
    if (!node) return;

    node.status = status;
    saveState();
    renderAll(false);

    if (celebrate && status === "done") {
      celebrateNode(node);
    }
  }

  function updateQuestProgress() {
    if (!state.rootId) {
      $("#questProgress").attr("hidden", true);
      return;
    }

    var actionable = Object.keys(state.nodes)
      .map(function (id) { return state.nodes[id]; })
      .filter(function (node) {
        if (!node || !node.title || !node.title.trim() || node.depth < 2) return false;
        var hasFilledChildren = (node.children || []).some(function (childId) {
          return state.nodes[childId] && state.nodes[childId].title.trim();
        });
        return !hasFilledChildren && decisionValue(node) === "do" && !hasSuppressedAncestor(node);
      });

    if (!actionable.length) {
      $("#questProgress").attr("hidden", true);
      return;
    }

    var done = actionable.filter(function (node) {
      return node.status === "done";
    }).length;

    var percent = Math.round((done / actionable.length) * 100);
    $("#questProgress").removeAttr("hidden");
    $("#questProgressValue").text(percent + "%");
    $("#questProgressFill").css("width", percent + "%");

    var $hud = $("#questProgress");
    $hud.removeClass("progress-pop");
    void ($hud[0] && $hud[0].offsetWidth);
    $hud.addClass("progress-pop");
  }

  function celebrateNode(node) {
    if (!node) return;

    var messages = [
      ["Nice!", "One step closer."],
      ["Boom. Done.", "Let it settle. Keep moving."],
      ["Flow.", "One clear move changes the whole map."],
      ["Level cleared!", "Make it visible. Make it real."],
      ["Hell yes.", "Release it. Choose the next move."]
    ];

    var message = messages[Math.floor(Math.random() * messages.length)];
    $("#celebrationTitle").text(message[0]);
    $("#celebrationCopy").text(message[1]);

    var reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
      burstCompletionRipple(node.id);
      burstConfetti();
    }

    $("#celebration").removeAttr("hidden").addClass("show");

    setTimeout(function () {
      $("#celebration").removeClass("show");
    }, reduceMotion ? 650 : 1250);

    setTimeout(function () {
      $("#celebration").attr("hidden", true);
      $("#confettiLayer").empty();
    }, reduceMotion ? 850 : 1500);
  }

  function burstConfetti() {
    var colors = ["#ef7f69", "#e5b957", "#62c6a4", "#61b9cb", "#8f86cc", "#f19a79"];
    var fragment = document.createDocumentFragment();
    var count = window.innerWidth < 680 ? 24 : 38;

    for (var i = 0; i < count; i++) {
      var piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.setProperty("--x", (Math.random() * 200 - 100).toFixed(1) + "vw");
      piece.style.setProperty("--y", (55 + Math.random() * 45).toFixed(1) + "vh");
      piece.style.setProperty("--r", Math.round(Math.random() * 720 - 360) + "deg");
      piece.style.setProperty("--delay", (Math.random() * .12).toFixed(2) + "s");
      piece.style.setProperty("--size", Math.round(7 + Math.random() * 7) + "px");
      piece.style.background = colors[i % colors.length];
      fragment.appendChild(piece);
    }

    var layer = document.getElementById("confettiLayer");
    if (!layer) return;
    layer.innerHTML = "";
    layer.appendChild(fragment);
  }

  function burstCompletionRipple(id) {
    var nodeEl = document.querySelector('.map-node[data-id="' + id + '"]');
    if (!nodeEl) return;

    var rect = nodeEl.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < 3; i++) {
      var ring = document.createElement("i");
      ring.className = "completion-ripple";
      ring.style.left = x + "px";
      ring.style.top = y + "px";
      ring.style.setProperty("--ripple-delay", (i * .11) + "s");
      fragment.appendChild(ring);
    }

    document.body.appendChild(fragment);

    setTimeout(function () {
      document.querySelectorAll(".completion-ripple").forEach(function (ring) {
        ring.remove();
      });
    }, 1150);
  }

  function decisionValue(node) {
    return node && ["do", "defer", "delegate", "delete"].indexOf(node.decision) !== -1 ? node.decision : "do";
  }

  function decisionLabel(decision) {
    return {
      "do": "Do",
      "defer": "Later",
      "delegate": "Hand off",
      "delete": "Drop"
    }[decision] || "Do";
  }

  function decisionOptions(selected) {
    return ["do", "defer", "delegate", "delete"].map(function (value) {
      return '<option value="' + value + '"' + (selected === value ? " selected" : "") + '>' +
        decisionLabel(value) + '</option>';
    }).join("");
  }

  function scoreOptions(selected) {
    selected = parseInt(selected || 3, 10);
    return [1, 2, 3, 4, 5].map(function (value) {
      return '<option value="' + value + '"' + (selected === value ? " selected" : "") + '>' +
        value + '</option>';
    }).join("");
  }

  function isDependencyResolved(node) {
    if (!node || !node.dependencyId) return true;
    var dependency = state.nodes[node.dependencyId];
    if (!dependency) return true;
    return dependency.status === "done" || decisionValue(dependency) === "delete";
  }

  function isNodeBlocked(node) {
    return !!(node && node.dependencyId && !isDependencyResolved(node));
  }

  function dependencyStateLabel(node) {
    if (!node || !node.dependencyId) return "Ready";
    var dependency = state.nodes[node.dependencyId];
    if (!dependency) return "Ready";
    if (isDependencyResolved(node)) return "Ready";
    return "Blocked by " + (dependency.title.trim() || typeLabel(dependency));
  }

  function hasSuppressedAncestor(node) {
    var cursor = node && node.parentId ? state.nodes[node.parentId] : null;

    while (cursor) {
      if (cursor.depth >= 1 && decisionValue(cursor) !== "do") return true;
      cursor = cursor.parentId ? state.nodes[cursor.parentId] : null;
    }

    return false;
  }

  function executionNodes() {
    return Object.keys(state.nodes)
      .map(function (id) { return state.nodes[id]; })
      .filter(function (node) {
        return node && node.title && node.title.trim() && node.depth >= 2;
      });
  }

  function renderTriageSummary() {
    var nodes = executionNodes();
    var counts = { do: 0, defer: 0, delegate: 0, delete: 0, ready: 0, blocked: 0, done: 0 };

    nodes.forEach(function (node) {
      counts[decisionValue(node)] += 1;
      if (node.status === "done") counts.done += 1;
      if (decisionValue(node) === "do" && !hasSuppressedAncestor(node)) {
        if (isNodeBlocked(node)) counts.blocked += 1;
        else counts.ready += 1;
      }
    });

    var html =
      '<span class="triage-chip do"><b>' + counts.do + '</b> Do</span>' +
      '<span class="triage-chip defer"><b>' + counts.defer + '</b> Later</span>' +
      '<span class="triage-chip delegate"><b>' + counts.delegate + '</b> Hand off</span>' +
      '<span class="triage-chip delete"><b>' + counts.delete + '</b> Drop</span>' +
      '<span class="triage-chip ready"><b>' + counts.ready + '</b> ready</span>' +
      '<span class="triage-chip blocked"><b>' + counts.blocked + '</b> blocked</span>';

    $("#triageSummary").html(html);
  }

  function openReviewModal() {
    var nodes = executionNodes();
    var counts = { do: 0, defer: 0, delegate: 0, delete: 0, ready: 0, blocked: 0, done: 0 };

    nodes.forEach(function (node) {
      counts[decisionValue(node)] += 1;
      if (node.status === "done") counts.done += 1;
      if (decisionValue(node) === "do" && !hasSuppressedAncestor(node)) {
        if (isNodeBlocked(node)) counts.blocked += 1;
        else counts.ready += 1;
      }
    });

    $("#reviewStats").html(
      '<div><b>' + counts.done + '</b><span>done</span></div>' +
      '<div><b>' + counts.ready + '</b><span>ready</span></div>' +
      '<div><b>' + counts.defer + '</b><span>later</span></div>' +
      '<div><b>' + counts.delegate + '</b><span>handed off</span></div>' +
      '<div><b>' + counts.delete + '</b><span>dropped</span></div>' +
      '<div><b>' + counts.blocked + '</b><span>blocked</span></div>'
    );

    $("#reviewModal").removeAttr("hidden");
  }

  function updateCanvasStatus() {
    var nodes = executionNodes();
    var active = nodes.filter(function (node) {
      return decisionValue(node) === "do" && !hasSuppressedAncestor(node);
    });
    var done = active.filter(function (node) { return node.status === "done"; }).length;
    var doNow = active.filter(function (node) {
      return !isNodeBlocked(node) && node.status !== "done";
    }).length;
    var cut = nodes.filter(function (node) { return decisionValue(node) === "delete"; }).length;

    $("#canvasStatusText").text(
      done + " done · " + doNow + " ready · " + cut + " dropped · Drag nodes to move"
    );
  }

  function isArrowKey(key) {
    return key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "ArrowLeft" ||
      key === "ArrowRight";
  }

  function isKeyboardTypingTarget(target) {
    return $(target).is("textarea,input,select,button,a,[contenteditable='true']");
  }

  function isPlannerOverlayOpen() {
    return $("#inspector").hasClass("open") ||
      !$("#suggestionModal").is("[hidden]") ||
      !$("#nextModal").is("[hidden]") ||
      !$("#reviewModal").is("[hidden]") ||
      !$("#mapsModal").is("[hidden]");
  }

  function directionVector(key) {
    return {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }
    }[key] || null;
  }

  function viewportCenterWorld() {
    return {
      x: (viewportWidth() / 2 - camera.x) / camera.scale,
      y: (viewportHeight() / 2 - camera.y) / camera.scale
    };
  }

  function findDirectionalNode(origin, direction, excludeId, ids) {
    var best = null;
    var bestScore = Infinity;
    var fallback = null;
    var fallbackScore = Infinity;

    ids.forEach(function (id) {
      if (id === excludeId || !renderPositions[id] || !state.nodes[id]) return;

      var pos = renderPositions[id];
      var dx = pos.x - origin.x;
      var dy = pos.y - origin.y;
      var forward = dx * direction.x + dy * direction.y;
      if (forward <= 8) return;

      var distanceToNode = Math.max(Math.hypot(dx, dy), 1);
      var alignment = forward / distanceToNode;
      var lateral = Math.abs(dx * direction.y - dy * direction.x);

      var looseScore = distanceToNode + lateral * 1.35;
      if (looseScore < fallbackScore) {
        fallbackScore = looseScore;
        fallback = id;
      }

      if (alignment < .34) return;

      var score = distanceToNode * (1 + (1 - alignment) * 2.8) + lateral * .22;
      if (score < bestScore) {
        bestScore = score;
        best = id;
      }
    });

    return best || fallback;
  }

  function navigateMapByArrow(key) {
    if (!state.rootId || activeView !== "map") return;

    var direction = directionVector(key);
    if (!direction) return;

    var ids = getVisibleNodeIds().filter(function (id) {
      return state.nodes[id] && renderPositions[id];
    });
    if (!ids.length) return;

    var origin = selectedId && renderPositions[selectedId]
      ? renderPositions[selectedId]
      : viewportCenterWorld();

    var nextId = findDirectionalNode(origin, direction, selectedId, ids);

    if (!nextId && !selectedId) {
      nextId = ids.reduce(function (bestId, id) {
        if (!bestId) return id;
        var center = viewportCenterWorld();
        var bestPos = renderPositions[bestId];
        var pos = renderPositions[id];
        var bestDist = Math.hypot(bestPos.x - center.x, bestPos.y - center.y);
        var dist = Math.hypot(pos.x - center.x, pos.y - center.y);
        return dist < bestDist ? id : bestId;
      }, null);
    }

    if (!nextId) return;

    selectedId = nextId;
    editingId = null;

    $("#mapNodes .map-node").removeClass("selected");
    var $next = $('.map-node[data-id="' + nextId + '"]');
    $next.addClass("selected");

    $("#mapViewport").addClass("keyboard-navigating");
    updateSelectionBar();
    focusCameraOnNode(nextId, camera.scale, 220);

    if ($next.length && $next[0].focus) {
      try { $next[0].focus({ preventScroll: true }); }
      catch (ignore) { $next[0].focus(); }
    }
  }

  function panMapByArrow(key) {
    var direction = directionVector(key);
    if (!direction) return;

    var step = Math.max(90, Math.min(viewportWidth(), viewportHeight()) * .18);
    var targetX = camera.x - direction.x * step;
    var targetY = camera.y - direction.y * step;

    animateCameraTo(targetX, targetY, camera.scale, 180);
  }

  function clearMapSelection() {
    if (!selectedId && !editingId) return;

    selectedId = null;
    editingId = null;
    $("#mapNodes .map-node").removeClass("selected");
    $("#mapViewport").removeClass("keyboard-navigating");
    updateSelectionBar();
  }

  function startPromptRotation() {
    stopPromptRotation();
    promptIndex = 0;

    var $verb = $("#rotatingVerb");
    if (!$verb.length) return;

    $verb.text(PROMPTS[0]);

    promptTimer = setInterval(function () {
      promptIndex = (promptIndex + 1) % PROMPTS.length;

      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        $verb.text(PROMPTS[promptIndex]);
        return;
      }

      $verb.addClass("swap-out");

      promptSwapTimer = setTimeout(function () {
        $verb.text(PROMPTS[promptIndex]).removeClass("swap-out").addClass("swap-in");
        promptSwapTimer = setTimeout(function () {
          $verb.removeClass("swap-in");
          promptSwapTimer = null;
        }, 220);
      }, 180);
    }, 2800);
  }

  function stopPromptRotation() {
    if (promptTimer) {
      clearInterval(promptTimer);
      promptTimer = null;
    }

    if (promptSwapTimer) {
      clearTimeout(promptSwapTimer);
      promptSwapTimer = null;
    }

    $("#rotatingVerb").removeClass("swap-out swap-in");
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
          node.depth >= 2 &&
          decisionValue(node) === "do" &&
          !hasSuppressedAncestor(node) &&
          !isNodeBlocked(node);
      });

    candidates.sort(function (a, b) {
      return scoreNode(b) - scoreNode(a);
    });

    currentNextId = candidates.length ? candidates[0].id : null;

    if (!currentNextId) {
      $("#nextActionTitle").text("No ready action yet.");
      $("#nextActionMeta").text("Choose Do for an action, clear blockers, or split work that is still too broad.");
      $("#openNextAction, #completeNextAction").prop("disabled", true).css("opacity", .45);
    } else {
      var node = state.nodes[currentNextId];
      var meta = [];
      if (node.duration) meta.push(node.duration + " min");
      meta.push("impact " + (node.impact || 3) + "/5");
      meta.push("effort " + (node.effort || 3) + "/5");
      meta.push("ready");

      $("#nextActionTitle").text(node.title);
      $("#nextActionMeta").text(meta.join(" · "));
      $("#openNextAction, #completeNextAction").prop("disabled", false).css("opacity", 1);
    }

    $("#nextModal").removeAttr("hidden");
  }

  function scoreNode(node) {
    var impact = parseInt(node.impact || 3, 10);
    var effort = parseInt(node.effort || 3, 10);
    var score = impact * 2 - effort;

    if (node.status === "doing") score += 2;
    if (node.duration && parseInt(node.duration, 10) <= 30) score += 1;

    return score;
  }

  function openInspector(id) {
    var node = state.nodes[id];
    if (!node) return;

    selectedDetailId = id;
    $("#inspectorTitle").text(typeLabel(node).toLowerCase());
    $("#detailTitle").val(node.title);
    $("#impactInput").val(node.impact || 3);
    $("#effortInput").val(node.effort || 3);
    $("#impactOutput").text(node.impact || 3);
    $("#effortOutput").text(node.effort || 3);
    $("#decisionInput").val(decisionValue(node));
    populateDependencyOptions(node);
    $("#dependencyInput").val(node.dependencyId || "");
    $("#delegatedToInput").val(node.delegatedTo || "");
    $("#deferUntilInput").val(node.deferUntil || "");
    syncDecisionFields(decisionValue(node));
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
    var decision = decisionValue(node);
    var blocked = isNodeBlocked(node);
    var label = decisionLabel(decision);
    var copy = "Keep it simple: decide, then move.";

    if (decision === "delete") {
      label = "Drop";
      copy = "Keep the decision visible, but stop spending time on it.";
    } else if (decision === "delegate") {
      label = "Hand off";
      copy = node.delegatedTo ? "Hand this to " + node.delegatedTo + "." : "This should happen, but it does not need to be yours.";
    } else if (decision === "defer") {
      label = "Later";
      copy = node.deferUntil ? "Bring it back on " + node.deferUntil + "." : "Keep it, but take it out of the current queue.";
    } else if (blocked) {
      label = "Blocked";
      copy = dependencyStateLabel(node);
    } else if (impact >= 4 && effort <= 2) {
      label = "Strong move";
      copy = "High impact, relatively low effort. Good candidate for Next move.";
    } else if (impact >= 4 && effort >= 4) {
      label = "Big move";
      copy = "Worth doing, but expensive. Split it if the first step is not obvious.";
    } else if (impact <= 2 && effort >= 4) {
      label = "Question it";
      copy = "A lot of work for limited impact. Later or Drop may be better.";
    } else {
      label = "Ready";
      copy = "This can stay in the active plan.";
    }

    $("#priorityLabel").text(label);
    $("#priorityCopy").text(copy);
  }

  function syncDecisionFields(decision) {
    $("#delegateField").attr("hidden", decision !== "delegate");
    $("#deferField").attr("hidden", decision !== "defer");
  }

  function populateDependencyOptions(node) {
    var options = ['<option value="">Nothing — ready</option>'];

    Object.keys(state.nodes).forEach(function (id) {
      var candidate = state.nodes[id];
      if (!candidate || id === node.id || !candidate.title.trim()) return;
      if (isDescendantOf(id, node.id)) return;

      options.push('<option value="' + id + '">' +
        escapeHtml(typeLabel(candidate) + ": " + candidate.title.trim()) + '</option>');
    });

    $("#dependencyInput").html(options.join(""));
  }

  function isDescendantOf(candidateId, ancestorId) {
    var cursor = state.nodes[candidateId];

    while (cursor && cursor.parentId) {
      if (cursor.parentId === ancestorId) return true;
      cursor = state.nodes[cursor.parentId];
    }

    return false;
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
    node.decision = "do";
    node.dependencyId = null;
    delete node.urgency;
    delete node.important;
    delete node.urgent;
    delete node.delegatable;
    node.delegatedTo = "";
    node.deferUntil = "";
    node.duration = "";
    node.notes = "";
    node.collapsed = false;
    node.tableCollapsed = false;
    node.offsetX = 0;
    node.offsetY = 0;

    Object.keys(state.nodes).forEach(function (id) {
      if (state.nodes[id] && state.nodes[id].dependencyId === selectedDetailId) {
        state.nodes[id].dependencyId = null;
      }
    });

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

  async function openMapsModal() {
    if (!storageReady) {
      showToast("Map library needs IndexedDB in this browser.");
      return;
    }

    await persistCurrentMapNow();
    snapshotHistoryMapId = null;
    $("#snapshotHistoryView").attr("hidden", true);
    $("#mapsLibraryView").removeAttr("hidden");
    await renderMapsLibrary();
    $("#mapsModal").removeAttr("hidden");
  }

  function closeMapsModal() {
    $("#mapsModal").attr("hidden", true);
    snapshotHistoryMapId = null;
    $("#snapshotHistoryView").attr("hidden", true);
    $("#mapsLibraryView").removeAttr("hidden");
  }

  async function renderMapsLibrary() {
    if (!storageReady) return;

    var maps = await window.MandalaStorage.listMaps();

    if (!maps.length) {
      $("#mapsList").html(
        '<div class="maps-empty">' +
          '<strong>No saved maps yet.</strong>' +
          '<p>Create a goal and it will appear here automatically.</p>' +
        '</div>'
      );
      return;
    }

    var rows = await Promise.all(maps.map(async function (map) {
      return {
        map: map,
        snapshotCount: await window.MandalaStorage.countSnapshots(map.id)
      };
    }));

    var html = rows.map(function (entry) {
      var map = entry.map;
      var current = map.id === currentMapId;
      return '<article class="map-card' + (current ? ' current' : '') + '" data-map-id="' + map.id + '">' +
        '<div class="map-card-copy">' +
          '<div class="map-card-title-row">' +
            '<strong>' + escapeHtml(map.title || "Untitled map") + '</strong>' +
            (current ? '<span class="current-map-pill">Open</span>' : '') +
          '</div>' +
          '<span>Updated ' + escapeHtml(formatStoredTime(map.updatedAt)) +
            ' · ' + entry.snapshotCount + ' version' + (entry.snapshotCount === 1 ? '' : 's') + '</span>' +
        '</div>' +
        '<div class="map-card-actions">' +
          '<button class="soft-button map-open-button" type="button">' + (current ? 'Return' : 'Open') + '</button>' +
          '<button class="soft-button map-history-button" type="button">History</button>' +
          '<button class="map-delete-button" type="button" aria-label="Delete map" title="Delete map">×</button>' +
        '</div>' +
      '</article>';
    }).join("");

    $("#mapsList").html(html);
  }

  async function openStoredMap(mapId) {
    if (!storageReady || !mapId) return;

    await createAutosaveSnapshot("Before switching maps", true);
    await persistCurrentMapNow();
    var record = await window.MandalaStorage.getMap(mapId);
    if (!record || !record.state) return;

    currentMapId = record.id;
    currentMapCreatedAt = record.createdAt || Date.now();
    state = cloneState(record.state);
    state.version = 5;
    selectedId = state.rootId || null;
    editingId = null;
    selectedDetailId = null;
    currentNextId = null;
    activeView = "map";

    var latest = (await window.MandalaStorage.listSnapshots(currentMapId, 1))[0];
    lastSnapshotAt = latest ? (latest.createdAt || 0) : 0;

    await window.MandalaStorage.setActiveMapId(currentMapId);
    closeInspector();
    closeMapsModal();

    if (state.rootId && state.nodes[state.rootId]) {
      normalizeState();
      showMap();
      renderAll(false);
      setTimeout(function () { fitAll(true); }, 30);
    } else {
      showEmptyMap();
      startPromptRotation();
    }
  }

  async function deleteStoredMap(mapId) {
    if (!storageReady || !mapId) return;

    var record = await window.MandalaStorage.getMap(mapId);
    if (!record) return;

    if (!window.confirm('Delete "' + (record.title || "Untitled map") + '" and its autosave history?')) return;

    await window.MandalaStorage.deleteMap(mapId);

    if (mapId === currentMapId) {
      currentMapId = null;
      currentMapCreatedAt = null;
      state = defaultState();

      var remaining = await window.MandalaStorage.listMaps();

      if (remaining.length) {
        await openStoredMap(remaining[0].id);
        await openMapsModal();
      } else {
        closeMapsModal();
        startNewMap(true);
      }
      return;
    }

    await renderMapsLibrary();
  }

  async function openSnapshotHistory(mapId) {
    if (!storageReady || !mapId) return;

    await persistCurrentMapNow();

    var record = await window.MandalaStorage.getMap(mapId);
    if (!record) return;

    snapshotHistoryMapId = mapId;
    $("#mapsLibraryView").attr("hidden", true);
    $("#snapshotHistoryView").removeAttr("hidden");
    $("#snapshotMapTitle").text(record.title || "Untitled map");

    var snapshots = await window.MandalaStorage.listSnapshots(mapId);

    if (!snapshots.length) {
      $("#snapshotList").html(
        '<div class="maps-empty">' +
          '<strong>No versions yet.</strong>' +
          '<p>Keep editing. Autosave history appears after a few seconds.</p>' +
        '</div>'
      );
      return;
    }

    var html = snapshots.map(function (snapshot, index) {
      return '<article class="snapshot-row" data-snapshot-id="' + snapshot.id + '">' +
        '<div>' +
          '<strong>' + escapeHtml(index === 0 ? "Latest saved version" : "Saved version") + '</strong>' +
          '<span>' + escapeHtml(formatStoredTime(snapshot.createdAt)) +
            ' · ' + escapeHtml(snapshot.reason || "Autosave") + '</span>' +
        '</div>' +
        '<button class="soft-button snapshot-restore-button" type="button">Restore</button>' +
      '</article>';
    }).join("");

    $("#snapshotList").html(html);
  }

  async function restoreSnapshot(snapshotId) {
    if (!storageReady || !snapshotId) return;

    var snapshot = await window.MandalaStorage.getSnapshot(snapshotId);
    if (!snapshot || !snapshot.state) return;

    var record = await window.MandalaStorage.getMap(snapshot.mapId);
    if (!record) return;

    if (!window.confirm("Restore this version? The current version will be saved first.")) return;

    if (snapshot.mapId === currentMapId) {
      await persistCurrentMapNow();
      await createAutosaveSnapshot("Before restore", true);
      record = await window.MandalaStorage.getMap(snapshot.mapId);
    } else if (record.state && record.state.rootId) {
      await window.MandalaStorage.createSnapshot(
        record.id,
        record.title || "Untitled map",
        cloneState(record.state),
        "Before restore"
      );
    }

    var restoredState = cloneState(snapshot.state);
    restoredState.version = 5;

    await window.MandalaStorage.saveMap({
      id: record.id,
      title: currentMapTitle(restoredState),
      createdAt: record.createdAt || Date.now(),
      updatedAt: Date.now(),
      state: restoredState
    });

    currentMapId = record.id;
    currentMapCreatedAt = record.createdAt || Date.now();
    state = restoredState;
    selectedId = state.rootId || null;
    editingId = null;
    selectedDetailId = null;
    currentNextId = null;
    activeView = "map";
    lastSnapshotAt = snapshot.createdAt || 0;

    await window.MandalaStorage.setActiveMapId(currentMapId);
    closeInspector();
    closeMapsModal();

    normalizeState();
    showMap();
    renderAll(false);
    setTimeout(function () { fitAll(true); }, 30);
    showToast("Version restored.");
  }

  function formatStoredTime(timestamp) {
    if (!timestamp) return "just now";

    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(timestamp));
    } catch (error) {
      return new Date(timestamp).toLocaleString();
    }
  }

  async function startNewMap(skipPersist) {
    if (!skipPersist) {
      await createAutosaveSnapshot("Before new map", true);
      await persistCurrentMapNow();
    }

    clearTimeout(stateSaveTimer);
    clearTimeout(snapshotTimer);
    stateSaveTimer = null;
    snapshotTimer = null;

    if (!storageReady) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    state = defaultState();
    currentMapId = null;
    currentMapCreatedAt = null;
    lastSnapshotAt = 0;
    selectedId = null;
    editingId = null;
    selectedDetailId = null;
    currentNextId = null;
    activeView = "map";

    closeInspector();
    showEmptyMap();
    startPromptRotation();
  }

  async function resetAll() {
    if (state.rootId && !window.confirm("Start a new map? Your current map will stay saved in Maps.")) return;
    await startNewMap();
  }

  function exportState() {
    if (!state.rootId) return;

    var payload = {
      exportedAt: new Date().toISOString(),
      version: state.version || 5,
      rootId: state.rootId,
      nodes: state.nodes
    };

    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "mandala-map.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Map exported.");
  }

  function availableThemes() {
    return ["light", "dark", "sage", "dawn"];
  }

  function normalizeTheme(theme) {
    return availableThemes().indexOf(theme) !== -1 ? theme : "light";
  }

  function toggleThemePalette() {
    var $palette = $("#themePalette");
    var opening = $palette.is("[hidden]");

    if (opening) {
      $palette.removeAttr("hidden");
      $("#themeButton").attr("aria-expanded", "true");
      updateThemeChoiceState();
      setTimeout(function () {
        $("#themePalette .theme-choice[aria-checked='true']").focus();
      }, 0);
    } else {
      closeThemePalette();
    }
  }

  function closeThemePalette() {
    $("#themePalette").attr("hidden", true);
    $("#themeButton").attr("aria-expanded", "false");
  }

  function setTheme(theme) {
    theme = normalizeTheme(theme);

    $("html").attr("data-theme", theme);

    $("body")
      .removeClass("dark theme-sage theme-dawn")
      .toggleClass("dark", theme === "dark")
      .toggleClass("theme-sage", theme === "sage")
      .toggleClass("theme-dawn", theme === "dawn")
      .attr("data-theme", theme);

    localStorage.setItem(THEME_KEY, theme);
    updateThemeChoiceState();
  }

  function updateThemeChoiceState() {
    var current = normalizeTheme($("body").attr("data-theme") || localStorage.getItem(THEME_KEY));
    $("#themePalette .theme-choice").each(function () {
      var active = $(this).data("theme") === current;
      $(this)
        .toggleClass("active", active)
        .attr("aria-checked", active ? "true" : "false");
    });

    var labels = {
      light: "Light",
      dark: "Dark",
      sage: "Sage",
      dawn: "Dawn"
    };

    var themeColors = {
      light: "#fbf8ef",
      dark: "#202624",
      sage: "#e7efe7",
      dawn: "#f3e6df"
    };

    $("#themeButton")
      .attr("title", "Palette: " + labels[current])
      .attr("aria-label", "Choose color palette. Current: " + labels[current]);

    $('meta[name="theme-color"]').attr("content", themeColors[current]);
  }

  function applyStoredTheme() {
    var stored = normalizeTheme(localStorage.getItem(THEME_KEY));
    setTheme(stored);
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
