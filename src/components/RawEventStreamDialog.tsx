import React, { useState, useEffect, useRef } from "react";
import { Activity, Play, Pause, Trash2, Download, Search, X, ChevronRight, Eye } from "lucide-react";
import { rawEventStream, type RawEventRecord } from "../services/rawEventStream";
import "./osintDialogs.css";

interface RawEventStreamDialogProps {
  onClose: () => void;
}

export function RawEventStreamDialog({ onClose }: RawEventStreamDialogProps) {
  const [events, setEvents] = useState<RawEventRecord[]>(() => rawEventStream.getRecentEvents(150));
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [activeRecord, setActiveRecord] = useState<RawEventRecord | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = rawEventStream.subscribe((record) => {
      if (isPaused) return;
      setEvents((prev) => [...prev.slice(-199), record]);
    });
    return unsubscribe;
  }, [isPaused]);

  useEffect(() => {
    if (!isPaused && !activeRecord) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, isPaused, activeRecord]);

  const filteredEvents = events.filter((ev) => {
    const matchesType = selectedType === "all" || ev.type.toLowerCase().includes(selectedType.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      ev.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(ev.data).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const clearStream = () => {
    rawEventStream.clear();
    setEvents([]);
    setActiveRecord(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tdlib-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="osint-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="osint-modal-card osint-stream-card" onClick={(e) => e.stopPropagation()}>
        <div className="osint-modal-header">
          <div className="osint-header-title">
            <Activity className="osint-shield-icon osint-pulse" size={20} />
            <h3>Live TDLib Event Stream</h3>
            <span className="osint-live-pill">{isPaused ? "Paused" : "Live"}</span>
          </div>
          <button className="osint-close-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="osint-stream-toolbar">
          <div className="osint-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search in events payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="osint-clear-input" onClick={() => setSearchQuery("")}>
                <X size={13} />
              </button>
            )}
          </div>

          <select
            className="osint-type-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all">All Event Types</option>
            <option value="updateNewMessage">New Messages (updateNewMessage)</option>
            <option value="updateMessageContent">Content Edits (updateMessageContent)</option>
            <option value="updateDeleteMessages">Message Deletions (updateDeleteMessages)</option>
            <option value="updateChatAction">Chat Actions / Typing (updateChatAction)</option>
            <option value="updateUserStatus">User Presence / Online (updateUserStatus)</option>
            <option value="updateConnectionState">Network State (updateConnectionState)</option>
          </select>

          <div className="osint-toolbar-actions">
            <button
              className={`osint-tool-btn ${isPaused ? "is-active" : ""}`}
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? "Resume Event Stream" : "Pause Event Stream"}
            >
              {isPaused ? <Play size={15} /> : <Pause size={15} />}
              <span>{isPaused ? "Resume" : "Pause"}</span>
            </button>
            <button className="osint-tool-btn" onClick={clearStream} title="Clear Event Buffer">
              <Trash2 size={15} />
              <span>Clear</span>
            </button>
            <button className="osint-tool-btn" onClick={exportJson} title="Export Events as JSON">
              <Download size={15} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Content split pane: list and detail inspector */}
        <div className="osint-stream-layout">
          <div className="osint-stream-list">
            {filteredEvents.length === 0 ? (
              <div className="osint-empty-state">No events matching filter. Waiting for incoming updates...</div>
            ) : (
              filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`osint-stream-row ${activeRecord?.id === ev.id ? "is-selected" : ""}`}
                  onClick={() => setActiveRecord(ev)}
                >
                  <span className="osint-row-time">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                  <span className={`osint-row-type type-${ev.type.slice(0, 14)}`}>{ev.type}</span>
                  <span className="osint-row-summary">{ev.summary}</span>
                  <ChevronRight size={14} className="osint-row-chevron" />
                </div>
              ))
            )}
            <div ref={listEndRef} />
          </div>

          {activeRecord && (
            <div className="osint-stream-detail">
              <div className="osint-detail-header">
                <h4>{activeRecord.type}</h4>
                <button
                  className="osint-detail-close"
                  onClick={() => setActiveRecord(null)}
                  title="Close Detail View"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="osint-detail-meta">
                <span>Timestamp: {new Date(activeRecord.timestamp).toLocaleString()}</span>
                <span>Record ID: {activeRecord.id}</span>
              </div>
              <pre className="osint-detail-json">{JSON.stringify(activeRecord.data, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="osint-modal-footer">
          <span className="osint-event-counter">
            Showing {filteredEvents.length} of {events.length} events
          </span>
          <button className="osint-primary-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
