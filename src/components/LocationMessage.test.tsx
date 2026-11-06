import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LocationMessage,
  formatCoordinates,
  formatDurationCountdown,
} from "./LocationMessage";
import type { Message, MessageLocationContent } from "../telegram/types";

describe("FG-022 LocationMessage Component & Utilities", () => {
  describe("formatCoordinates utility", () => {
    it("formats northern and western coordinates correctly", () => {
      expect(formatCoordinates(37.7749, -122.4194)).toBe("37.7749° N, 122.4194° W");
    });

    it("formats southern and eastern coordinates correctly", () => {
      expect(formatCoordinates(-33.8688, 151.2093)).toBe("33.8688° S, 151.2093° E");
    });

    it("formats zero coordinates at equator/prime meridian", () => {
      expect(formatCoordinates(0, 0)).toBe("0.0000° N, 0.0000° E");
    });
  });

  describe("formatDurationCountdown utility", () => {
    it("formats hours and minutes", () => {
      expect(formatDurationCountdown(7200)).toBe("2h 0m left");
      expect(formatDurationCountdown(3665)).toBe("1h 1m left");
    });

    it("formats minutes and seconds", () => {
      expect(formatDurationCountdown(900)).toBe("15m 0s left");
      expect(formatDurationCountdown(85)).toBe("1m 25s left");
    });

    it("formats seconds only", () => {
      expect(formatDurationCountdown(45)).toBe("45s left");
    });

    it("formats expired time", () => {
      expect(formatDurationCountdown(0)).toBe("Expired");
      expect(formatDurationCountdown(-10)).toBe("Expired");
    });
  });

  describe("Component Rendering", () => {
    const baseMessage: Message = {
      id: "msg_123",
      chatId: "chat_456",
      senderId: "user_789",
      sentAt: new Date(Date.now() - 60000).toISOString(),
      delivery: "read",
      outgoing: false,
      content: {
        kind: "location",
        latitude: 37.7749,
        longitude: -122.4194,
      },
    };

    it("renders static location message with coordinate card, status badge and maps actions", () => {
      const content: MessageLocationContent = {
        kind: "location",
        latitude: 37.7749,
        longitude: -122.4194,
        horizontalAccuracy: 12,
      };

      const html = renderToStaticMarkup(
        <LocationMessage
          message={baseMessage}
          content={content}
          isOutgoing={false}
        />
      );

      expect(html).toContain("Location");
      expect(html).toContain("37.7749° N, 122.4194° W");
      expect(html).toContain("±12m");
      expect(html).toContain("Open in Google Maps");
      expect(html).toContain("Copy coordinates");
    });

    it("renders venue location message with custom title and street address", () => {
      const content: MessageLocationContent = {
        kind: "location",
        latitude: 40.7128,
        longitude: -74.006,
        title: "Metropolitan Central Station",
        address: "89 E 42nd St, New York, NY",
      };

      const html = renderToStaticMarkup(
        <LocationMessage
          message={baseMessage}
          content={content}
          isOutgoing={false}
        />
      );

      expect(html).toContain("Metropolitan Central Station");
      expect(html).toContain("89 E 42nd St, New York, NY");
      expect(html).toContain("40.7128° N, 74.0060° W");
      expect(html).toContain("Open in Google Maps");
    });

    it("renders live location message with live badge and remaining duration", () => {
      const content: MessageLocationContent = {
        kind: "location",
        latitude: 51.5074,
        longitude: -0.1278,
        livePeriod: 3600,
        expiresIn: 3500,
        heading: 180,
      };

      const html = renderToStaticMarkup(
        <LocationMessage
          message={{ ...baseMessage, outgoing: true }}
          content={content}
          isOutgoing={true}
          onStopLiveLocation={vi.fn()}
        />
      );

      expect(html).toContain("Live Location");
      expect(html).toContain("left");
      expect(html).toContain("Stop Sharing");
    });

    it("does not render Stop Sharing for incoming live location", () => {
      const content: MessageLocationContent = {
        kind: "location",
        latitude: 51.5074,
        longitude: -0.1278,
        livePeriod: 3600,
        expiresIn: 3500,
      };

      const html = renderToStaticMarkup(
        <LocationMessage
          message={baseMessage}
          content={content}
          isOutgoing={false}
        />
      );

      expect(html).toContain("Live Location");
      expect(html).not.toContain("Stop Sharing");
    });

    it("renders expired status when live location has finished", () => {
      const content: MessageLocationContent = {
        kind: "location",
        latitude: 51.5074,
        longitude: -0.1278,
        livePeriod: 3600,
        expiresIn: 0,
      };

      const html = renderToStaticMarkup(
        <LocationMessage
          message={{ ...baseMessage, outgoing: true }}
          content={content}
          isOutgoing={true}
        />
      );

      expect(html).toContain("Live Ended");
      expect(html).toContain("Sharing expired");
      expect(html).not.toContain("Stop Sharing");
    });
  });
});

