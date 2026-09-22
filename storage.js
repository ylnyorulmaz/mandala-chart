(function (global) {
  "use strict";

  var DB_NAME = "mandala-local";
  var DB_VERSION = 1;
  var MAX_SNAPSHOTS_PER_MAP = 30;
  var dbPromise = null;

  function ensureIdb() {
    if (!global.idb || typeof global.idb.openDB !== "function") {
      throw new Error("idb is not available");
    }
  }

  function init() {
    if (dbPromise) return dbPromise;
    ensureIdb();

    dbPromise = global.idb.openDB(DB_NAME, DB_VERSION, {
      upgrade: function (db) {
        if (!db.objectStoreNames.contains("maps")) {
          var maps = db.createObjectStore("maps", { keyPath: "id" });
          maps.createIndex("updatedAt", "updatedAt");
        }

        if (!db.objectStoreNames.contains("snapshots")) {
          var snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
          snapshots.createIndex("mapId", "mapId");
          snapshots.createIndex("createdAt", "createdAt");
        }

        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      }
    });

    return dbPromise;
  }

  function makeId(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  function stateSignature(state) {
    var text = JSON.stringify(state);
    var hash = 2166136261;

    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return text.length.toString(36) + ":" + (hash >>> 0).toString(36);
  }

  async function listMaps() {
    var db = await init();
    var maps = await db.getAll("maps");
    return maps.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  async function getMap(id) {
    if (!id) return null;
    var db = await init();
    return (await db.get("maps", id)) || null;
  }

  async function saveMap(record) {
    if (!record || !record.id) throw new Error("Map record requires an id");
    var db = await init();
    await db.put("maps", record);
    return record;
  }

  async function deleteMap(id) {
    if (!id) return;
    var db = await init();
    await db.delete("maps", id);

    var snapshots = await listSnapshots(id);
    await Promise.all(snapshots.map(function (snapshot) {
      return db.delete("snapshots", snapshot.id);
    }));

    var active = await getMeta("activeMapId");
    if (active === id) await setMeta("activeMapId", null);
  }

  async function getMeta(key) {
    var db = await init();
    var row = await db.get("meta", key);
    return row ? row.value : null;
  }

  async function setMeta(key, value) {
    var db = await init();
    await db.put("meta", { key: key, value: value });
  }

  async function getActiveMapId() {
    return getMeta("activeMapId");
  }

  async function setActiveMapId(id) {
    return setMeta("activeMapId", id || null);
  }

  async function listSnapshots(mapId, limit) {
    var db = await init();
    var all = await db.getAll("snapshots");
    var rows = all.filter(function (snapshot) {
      return snapshot.mapId === mapId;
    }).sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (typeof limit === "number") return rows.slice(0, limit);
    return rows;
  }

  async function createSnapshot(mapId, title, state, reason) {
    if (!mapId || !state || !state.rootId) return null;

    var signature = stateSignature(state);
    var latest = (await listSnapshots(mapId, 1))[0];

    if (latest && latest.signature === signature) {
      return latest;
    }

    var snapshot = {
      id: makeId("snap"),
      mapId: mapId,
      title: title || "Untitled map",
      reason: reason || "Autosave",
      createdAt: Date.now(),
      signature: signature,
      state: state
    };

    var db = await init();
    await db.put("snapshots", snapshot);

    var snapshots = await listSnapshots(mapId);
    var excess = snapshots.slice(MAX_SNAPSHOTS_PER_MAP);

    await Promise.all(excess.map(function (row) {
      return db.delete("snapshots", row.id);
    }));

    return snapshot;
  }

  async function getSnapshot(id) {
    if (!id) return null;
    var db = await init();
    return (await db.get("snapshots", id)) || null;
  }

  async function countSnapshots(mapId) {
    return (await listSnapshots(mapId)).length;
  }

  global.MandalaStorage = {
    init: init,
    listMaps: listMaps,
    getMap: getMap,
    saveMap: saveMap,
    deleteMap: deleteMap,
    getActiveMapId: getActiveMapId,
    setActiveMapId: setActiveMapId,
    listSnapshots: listSnapshots,
    createSnapshot: createSnapshot,
    getSnapshot: getSnapshot,
    countSnapshots: countSnapshots
  };
})(window);
