import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactMessage } from "./ContactMessage";
import type { MessageContactContent } from "../telegram/types";

describe("FG-026 ContactMessage Component", () => {
  const mockContact: MessageContactContent = {
    kind: "contact",
    firstName: "Alice",
    lastName: "Smith",
    phoneNumber: "+1 555 123 4567",
    userId: "12345",
  };

  it("renders contact name, phone number and action buttons in English", () => {
    const html = renderToStaticMarkup(
      <ContactMessage content={mockContact} chatId="1001" />
    );

    expect(html).toContain("data-testid=\"contact-message-card\"");
    expect(html).toContain("Alice Smith");
    expect(html).toContain("+1 555 123 4567");
    expect(html).toContain("Message");
    expect(html).toContain("Add Contact");
  });

  it("handles contact without last name or userId gracefully", () => {
    const minimalContact: MessageContactContent = {
      kind: "contact",
      firstName: "Bob",
      phoneNumber: "+44 7700 900077",
    };

    const html = renderToStaticMarkup(
      <ContactMessage content={minimalContact} chatId="1001" />
    );

    expect(html).toContain("Bob");
    expect(html).toContain("+44 7700 900077");
    // Should not render direct "Message" button without userId
    expect(html).not.toContain("<span>Message</span>");
    expect(html).toContain("Add Contact");
  });
});

