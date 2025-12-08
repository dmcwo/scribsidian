#!/usr/bin/env python3
"""
Scribsidian TUI - Terminal User Interface for Kindle to Obsidian conversion
Built with Textual framework
"""

from textual.app import App, ComposeResult
from textual.containers import Container, Vertical, Horizontal, ScrollableContainer
from textual.widgets import (
    Header, Footer, Button, Static, Input, TextArea,
    Checkbox, Label, DataTable, ProgressBar
)
from textual.binding import Binding
from textual.screen import Screen
from pathlib import Path
import os

# Import existing functionality from scribsidian
from scribsidian import (
    parse_quotes,
    suggest_tags_for_all_quotes,
    write_quote_file,
    write_author_note,
    write_source_note,
    slugify,
    TEST_QUOTES,
    TEST_METADATA
)


# --------------------------
# Screen 1: Welcome
# --------------------------

class WelcomeScreen(Screen):
    """Welcome screen with intro and start button."""

    CSS = """
    WelcomeScreen {
        align: center middle;
    }

    #welcome-box {
        width: 70;
        height: auto;
        border: tall $primary;
        padding: 2 4;
        background: $surface;
    }

    .title {
        text-align: center;
        text-style: bold;
        color: $accent;
        margin-bottom: 1;
    }

    .description {
        text-align: center;
        margin-bottom: 2;
    }

    #button-container {
        align: center middle;
        width: 100%;
        height: auto;
        margin-top: 1;
    }

    Button {
        margin: 0 1;
    }
    """

    def compose(self) -> ComposeResult:
        yield Container(
            Static("📚 Scribsidian", classes="title"),
            Static("Transform Kindle highlights into Obsidian notes", classes="description"),
            Static("", classes="description"),
            Static("• Parse Kindle's \"Page X | Highlight\" format", classes="description"),
            Static("• Add rich metadata and tags", classes="description"),
            Static("• Generate connected notes with bi-directional links", classes="description"),
            Static("• AI-powered tag suggestions", classes="description"),
            Static("", classes="description"),
            Horizontal(
                Button("Start", variant="primary", id="start-btn"),
                Button("Load Test Data", variant="default", id="test-btn"),
                Button("Quit", variant="error", id="quit-btn"),
                id="button-container"
            ),
            id="welcome-box"
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "start-btn":
            self.app.push_screen(QuoteInputScreen())
        elif event.button.id == "test-btn":
            self.app.push_screen(QuoteInputScreen(test_mode=True))
        elif event.button.id == "quit-btn":
            self.app.exit()


# --------------------------
# Screen 2: Quote Input
# --------------------------

class QuoteInputScreen(Screen):
    """Screen for pasting Kindle highlights."""

    BINDINGS = [
        Binding("escape", "app.pop_screen", "Back"),
    ]

    CSS = """
    QuoteInputScreen {
        layout: vertical;
    }

    #header-box {
        height: 5;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    .step-title {
        text-style: bold;
        color: $accent;
    }

    #quote-area-container {
        height: 1fr;
        padding: 1 2;
    }

    #quote-area {
        height: 100%;
        border: solid $primary;
    }

    #footer-box {
        height: 4;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    #button-row {
        align: center middle;
        height: auto;
        width: 100%;
    }

    Button {
        margin: 0 1;
    }
    """

    def __init__(self, test_mode: bool = False):
        super().__init__()
        self.test_mode = test_mode
        self.quotes = []

    def compose(self) -> ComposeResult:
        yield Container(
            Static("Step 1/5: Paste Kindle Highlights", classes="step-title"),
            Static(f"📋 Detected quotes: 0", id="quote-count"),
            id="header-box"
        )

        text_area = TextArea(
            id="quote-area",
            language="markdown",
            theme="monokai"
        )

        if self.test_mode:
            text_area.text = TEST_QUOTES.strip()
        else:
            text_area.text = ""

        yield Container(
            text_area,
            id="quote-area-container"
        )

        yield Container(
            Horizontal(
                Button("Continue →", variant="primary", id="continue-btn"),
                Button("Cancel", variant="default", id="cancel-btn"),
                id="button-row"
            ),
            id="footer-box"
        )

    def on_mount(self) -> None:
        """Update quote count when screen loads."""
        if self.test_mode:
            self.update_quote_count()

    def on_text_area_changed(self, event: TextArea.Changed) -> None:
        """Update quote count as user types."""
        self.update_quote_count()

    def update_quote_count(self) -> None:
        """Parse and count quotes from text area."""
        text_area = self.query_one("#quote-area", TextArea)
        raw_text = text_area.text

        self.quotes = parse_quotes(raw_text)
        count_widget = self.query_one("#quote-count", Static)
        count_widget.update(f"📋 Detected quotes: {len(self.quotes)}")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "continue-btn":
            if len(self.quotes) == 0:
                self.notify("Please paste some Kindle highlights first", severity="warning")
                return

            # Pass quotes to next screen
            self.app.push_screen(MetadataScreen(self.quotes, self.test_mode))

        elif event.button.id == "cancel-btn":
            self.app.pop_screen()


# --------------------------
# Screen 3: Metadata Input
# --------------------------

class MetadataScreen(Screen):
    """Screen for entering source metadata."""

    BINDINGS = [
        Binding("escape", "app.pop_screen", "Back"),
    ]

    CSS = """
    MetadataScreen {
        layout: vertical;
    }

    #header-box {
        height: 4;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    .step-title {
        text-style: bold;
        color: $accent;
    }

    #form-container {
        height: 1fr;
        margin: 1 2;
        border: solid $primary;
        padding: 1 2;
        overflow-y: auto;
    }

    .field-label {
        margin-top: 1;
        margin-bottom: 0;
        color: $accent;
    }

    Input {
        margin-bottom: 1;
    }

    #footer-box {
        height: 4;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    #button-row {
        align: center middle;
        height: auto;
        width: 100%;
    }

    Button {
        margin: 0 1;
    }
    """

    def __init__(self, quotes: list, test_mode: bool = False):
        super().__init__()
        self.quotes = quotes
        self.test_mode = test_mode

    def compose(self) -> ComposeResult:
        yield Container(
            Static(f"Step 2/5: Source Metadata ({len(self.quotes)} quotes)", classes="step-title"),
            id="header-box"
        )

        yield ScrollableContainer(
            Static("Title:", classes="field-label"),
            Input(placeholder="Book title", id="title-input"),

            Static("Author:", classes="field-label"),
            Input(placeholder="Author name", id="author-input"),

            Static("Year:", classes="field-label"),
            Input(placeholder="Publication year", id="year-input"),

            Static("Publisher:", classes="field-label"),
            Input(placeholder="Publisher name", id="publisher-input"),

            Static("Link:", classes="field-label"),
            Input(placeholder="URL or DOI (optional)", id="link-input"),

            Static("Citation:", classes="field-label"),
            Input(placeholder="Full citation (optional)", id="citation-input"),

            Static("Tags:", classes="field-label"),
            Input(placeholder="Comma-separated tags", id="tags-input"),

            id="form-container"
        )

        yield Container(
            Horizontal(
                Button("← Back", variant="default", id="back-btn"),
                Button("Continue →", variant="primary", id="continue-btn"),
                id="button-row"
            ),
            id="footer-box"
        )

    def on_mount(self) -> None:
        """Pre-fill form with test data if in test mode."""
        if self.test_mode:
            self.query_one("#title-input", Input).value = TEST_METADATA["title"]
            self.query_one("#author-input", Input).value = TEST_METADATA["author"]
            self.query_one("#year-input", Input).value = TEST_METADATA["year"]
            self.query_one("#publisher-input", Input).value = TEST_METADATA["publisher"]
            self.query_one("#link-input", Input).value = TEST_METADATA["link"]
            self.query_one("#citation-input", Input).value = TEST_METADATA["citation"]
            self.query_one("#tags-input", Input).value = ", ".join(TEST_METADATA["tags"])

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "continue-btn":
            # Collect metadata
            metadata = {
                "title": self.query_one("#title-input", Input).value.strip(),
                "author": self.query_one("#author-input", Input).value.strip(),
                "year": self.query_one("#year-input", Input).value.strip(),
                "publisher": self.query_one("#publisher-input", Input).value.strip(),
                "link": self.query_one("#link-input", Input).value.strip(),
                "citation": self.query_one("#citation-input", Input).value.strip(),
                "format": "book",
            }

            # Parse tags
            tags_input = self.query_one("#tags-input", Input).value.strip()
            metadata["tags"] = [t.strip() for t in tags_input.split(",")] if tags_input else []

            # Validate required fields
            if not metadata["title"]:
                self.notify("Please enter a title", severity="error")
                return
            if not metadata["author"]:
                self.notify("Please enter an author", severity="error")
                return

            # Generate slugs
            metadata["author_slug"] = slugify(metadata["author"])
            metadata["source_slug"] = slugify(metadata["title"])

            # Generate tag suggestions for all quotes
            suggest_tags_for_all_quotes(self.quotes)

            # Move to tagging screen
            self.app.push_screen(TagQuotesScreen(self.quotes, metadata))

        elif event.button.id == "back-btn":
            self.app.pop_screen()


# --------------------------
# Screen 4: Tag Quotes
# --------------------------

class TagQuotesScreen(Screen):
    """Screen for tagging each quote individually."""

    BINDINGS = [
        Binding("escape", "app.pop_screen", "Back"),
        Binding("n", "next_quote", "Next", show=True),
        Binding("p", "prev_quote", "Previous", show=True),
    ]

    CSS = """
    TagQuotesScreen {
        layout: vertical;
    }

    #header-box {
        height: 4;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    .step-title {
        text-style: bold;
        color: $accent;
    }

    #content-area {
        height: 1fr;
        margin: 1 2;
    }

    #quote-display {
        height: 12;
        border: solid $accent;
        padding: 1 2;
        margin-bottom: 1;
        overflow-y: auto;
    }

    .quote-text {
        text-style: italic;
    }

    .quote-meta {
        color: $text-muted;
        margin-top: 1;
    }

    #tag-area {
        height: 1fr;
        border: solid $primary;
        padding: 1 2;
        overflow-y: auto;
    }

    .section-title {
        text-style: bold;
        color: $accent;
        margin-bottom: 1;
    }

    Checkbox {
        margin: 0 2;
    }

    #custom-tag-box {
        margin-top: 1;
        padding-top: 1;
        border-top: solid $primary;
    }

    Input {
        margin-top: 1;
    }

    #footer-box {
        height: 5;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    #button-row {
        align: center middle;
        height: auto;
        width: 100%;
    }

    Button {
        margin: 0 1;
    }
    """

    def __init__(self, quotes: list, metadata: dict):
        super().__init__()
        self.quotes = quotes
        self.metadata = metadata
        self.current_index = 0

        # Initialize tags list for each quote
        for q in self.quotes:
            if "tags" not in q:
                q["tags"] = []

    def compose(self) -> ComposeResult:
        yield Container(
            Static(f"Step 3/5: Tag Quotes (1/{len(self.quotes)})", id="step-header", classes="step-title"),
            id="header-box"
        )

        yield Container(
            Container(
                Static("", id="quote-text", classes="quote-text"),
                Static("", id="quote-meta", classes="quote-meta"),
                id="quote-display"
            ),
            ScrollableContainer(
                Static("✨ Suggested Tags (select relevant ones):", classes="section-title"),
                Container(id="checkboxes-container"),
                Container(
                    Static("➕ Custom Tags:", classes="section-title"),
                    Input(placeholder="Add custom tags (comma-separated)", id="custom-tags-input"),
                    id="custom-tag-box"
                ),
                id="tag-area"
            ),
            id="content-area"
        )

        yield Container(
            Static("Press 'n' for next, 'p' for previous, or use buttons below.", id="instructions"),
            Horizontal(
                Button("← Back", variant="default", id="back-btn"),
                Button("Skip All →", variant="default", id="skip-btn"),
                Button("Continue →", variant="primary", id="continue-btn"),
                id="button-row"
            ),
            id="footer-box"
        )

    def on_mount(self) -> None:
        """Display first quote."""
        self.display_quote()

    def display_quote(self) -> None:
        """Display the current quote and its suggested tags."""
        if not self.quotes:
            return

        quote = self.quotes[self.current_index]

        # Update header
        step_header = self.query_one("#step-header", Static)
        step_header.update(f"Step 3/5: Tag Quotes ({self.current_index + 1}/{len(self.quotes)})")

        # Update quote display
        quote_text = self.query_one("#quote-text", Static)
        quote_text.update(f'"{quote["text"]}"')

        quote_meta = self.query_one("#quote-meta", Static)
        quote_meta.update(f"— Page {quote['page']}")

        # Clear existing checkboxes
        checkbox_container = self.query_one("#checkboxes-container", Container)
        checkbox_container.remove_children()

        # Create checkboxes for suggested tags
        suggested_tags = quote.get("suggested_tags", [])
        existing_tags = quote.get("tags", [])

        for tag in suggested_tags:
            checkbox = Checkbox(tag, value=(tag in existing_tags), id=f"tag-{tag}")
            checkbox_container.mount(checkbox)

        # Clear custom tags input (or show existing custom tags not in suggestions)
        custom_input = self.query_one("#custom-tags-input", Input)
        custom_tags = [t for t in existing_tags if t not in suggested_tags]
        custom_input.value = ", ".join(custom_tags) if custom_tags else ""

    def collect_current_tags(self) -> None:
        """Collect selected tags for current quote."""
        quote = self.quotes[self.current_index]
        tags = []

        # Collect checked tags
        checkboxes = self.query(Checkbox)
        for cb in checkboxes:
            if cb.value and cb.label:
                tag_text = str(cb.label).strip()
                if tag_text:
                    tags.append(tag_text)

        # Collect custom tags
        custom_input = self.query_one("#custom-tags-input", Input)
        custom_text = custom_input.value.strip()
        if custom_text:
            custom_tags = [t.strip().lower().replace(" ", "-") for t in custom_text.split(",")]
            tags.extend([t for t in custom_tags if t])

        # Remove duplicates while preserving order
        seen = set()
        unique_tags = []
        for tag in tags:
            if tag not in seen:
                seen.add(tag)
                unique_tags.append(tag)

        quote["tags"] = unique_tags

    def action_next_quote(self) -> None:
        """Navigate to next quote."""
        self.collect_current_tags()

        if self.current_index < len(self.quotes) - 1:
            self.current_index += 1
            self.display_quote()
        else:
            self.notify("Last quote reached", severity="information")

    def action_prev_quote(self) -> None:
        """Navigate to previous quote."""
        self.collect_current_tags()

        if self.current_index > 0:
            self.current_index -= 1
            self.display_quote()
        else:
            self.notify("First quote reached", severity="information")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "continue-btn":
            # Save current quote's tags
            self.collect_current_tags()

            # Move to review screen
            self.app.push_screen(ReviewScreen(self.quotes, self.metadata))

        elif event.button.id == "skip-btn":
            # Skip tagging - leave all tags empty
            for quote in self.quotes:
                if "tags" not in quote or not quote["tags"]:
                    quote["tags"] = []

            self.app.push_screen(ReviewScreen(self.quotes, self.metadata))

        elif event.button.id == "back-btn":
            self.collect_current_tags()
            self.app.pop_screen()


# --------------------------
# Screen 5: Review
# --------------------------

class ReviewScreen(Screen):
    """Review all data before generating files."""

    BINDINGS = [
        Binding("escape", "app.pop_screen", "Back"),
    ]

    CSS = """
    ReviewScreen {
        layout: vertical;
    }

    #header-box {
        height: 3;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    .step-title {
        text-style: bold;
        color: $accent;
    }

    #content-area {
        height: 1fr;
        margin: 1 2;
        border: solid $primary;
        padding: 1 2;
        overflow-y: auto;
    }

    .section-title {
        text-style: bold;
        color: $accent;
        margin-top: 1;
        margin-bottom: 1;
    }

    .info-line {
        margin-left: 2;
    }

    #quote-table {
        margin: 1 2;
        height: auto;
    }

    #footer-box {
        height: 5;
        border: solid $primary;
        padding: 1 2;
        background: $surface;
    }

    #button-row {
        align: center middle;
        margin-top: 1;
    }

    Button {
        margin: 0 1;
    }
    """

    def __init__(self, quotes: list, metadata: dict):
        super().__init__()
        self.quotes = quotes
        self.metadata = metadata

    def compose(self) -> ComposeResult:
        yield Container(
            Static("Step 4/5: Review & Generate", classes="step-title"),
            id="header-box"
        )

        yield ScrollableContainer(
            Static("📖 Source Metadata", classes="section-title"),
            Static(f"Title: {self.metadata['title']}", classes="info-line"),
            Static(f"Author: {self.metadata['author']}", classes="info-line"),
            Static(f"Year: {self.metadata['year']}", classes="info-line"),
            Static(f"Publisher: {self.metadata['publisher']}", classes="info-line"),
            Static(f"Tags: {', '.join(self.metadata['tags']) if self.metadata['tags'] else 'None'}", classes="info-line"),

            Static("", classes="info-line"),
            Static(f"📝 Quotes Summary", classes="section-title"),
            Static(f"Total quotes: {len(self.quotes)}", classes="info-line"),
            Static(f"Tagged quotes: {sum(1 for q in self.quotes if q.get('tags'))}", classes="info-line"),
            Static(f"Untagged quotes: {sum(1 for q in self.quotes if not q.get('tags'))}", classes="info-line"),

            Static("", classes="info-line"),
            Static("✅ Files to be generated:", classes="section-title"),
            Static(f"• {self.metadata['source_slug']}.md (source note)", classes="info-line"),
            Static(f"• {self.metadata['author_slug']}.md (author note)", classes="info-line"),
            Static(f"• {len(self.quotes)} quote notes", classes="info-line"),
            Static(f"• Output: ../../scribsidian_outputs/", classes="info-line"),

            id="content-area"
        )

        yield Container(
            Static("Ready to generate markdown files?", id="instructions"),
            Horizontal(
                Button("← Back", variant="default", id="back-btn"),
                Button("Generate Files ✨", variant="success", id="generate-btn"),
                id="button-row"
            ),
            id="footer-box"
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "generate-btn":
            # Generate files
            self.generate_files()

        elif event.button.id == "back-btn":
            self.app.pop_screen()

    def generate_files(self) -> None:
        """Generate all markdown files."""
        try:
            # Create output directory
            output_dir = Path("../../scribsidian_outputs").resolve()
            output_dir.mkdir(parents=True, exist_ok=True)
            os.chdir(output_dir)

            # Write notes
            write_author_note(self.metadata)
            write_source_note(self.metadata)

            for quote in self.quotes:
                write_quote_file(quote, self.metadata)

            # Show completion screen
            self.app.push_screen(CompletedScreen(len(self.quotes), output_dir))

        except Exception as e:
            self.notify(f"Error generating files: {e}", severity="error")


# --------------------------
# Screen 6: Completed
# --------------------------

class CompletedScreen(Screen):
    """Show completion message."""

    CSS = """
    CompletedScreen {
        align: center middle;
    }

    #complete-box {
        width: 70;
        height: auto;
        border: tall $success;
        padding: 2 4;
        background: $surface;
    }

    .title {
        text-align: center;
        text-style: bold;
        color: $success;
        margin-bottom: 1;
    }

    .description {
        text-align: center;
        margin-bottom: 1;
    }

    .path {
        text-align: center;
        text-style: bold;
        color: $accent;
        margin-bottom: 2;
    }

    #button-container {
        align: center middle;
        width: 100%;
        height: auto;
        margin-top: 1;
    }

    Button {
        margin: 0 1;
    }
    """

    def __init__(self, quote_count: int, output_dir: Path):
        super().__init__()
        self.quote_count = quote_count
        self.output_dir = output_dir

    def compose(self) -> ComposeResult:
        yield Container(
            Static("✨ Success!", classes="title"),
            Static("", classes="description"),
            Static(f"Generated {self.quote_count + 2} markdown files:", classes="description"),
            Static(f"• 1 source note", classes="description"),
            Static(f"• 1 author note", classes="description"),
            Static(f"• {self.quote_count} quote notes", classes="description"),
            Static("", classes="description"),
            Static("Output location:", classes="description"),
            Static(str(self.output_dir), classes="path"),
            Static("", classes="description"),
            Horizontal(
                Button("Done", variant="success", id="done-btn"),
                id="button-container"
            ),
            id="complete-box"
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "done-btn":
            self.app.exit()


# --------------------------
# Main App
# --------------------------

class ScribsidianApp(App):
    """Main Scribsidian TUI application."""

    CSS = """
    Screen {
        background: $background;
    }
    """

    TITLE = "Scribsidian - Kindle to Obsidian"

    def __init__(self, test_mode: bool = False):
        super().__init__()
        self.test_mode = test_mode

    def on_mount(self) -> None:
        """Show welcome screen on startup, or skip to test data if test_mode."""
        if self.test_mode:
            # Skip welcome and load test data directly
            self.push_screen(QuoteInputScreen(test_mode=True))
        else:
            self.push_screen(WelcomeScreen())


def run_tui(test_mode: bool = False):
    """Entry point for TUI mode."""
    app = ScribsidianApp(test_mode=test_mode)
    app.run()


if __name__ == "__main__":
    run_tui()
