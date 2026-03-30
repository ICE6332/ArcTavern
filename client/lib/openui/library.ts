import { createLibrary } from "@openuidev/react-lang";
import type { PromptOptions } from "@openuidev/react-lang";
import {
  UICard,
  Text,
  Heading,
  ItemList,
  DataTable,
  CodeBlock,
  AlertBox,
  TagGroup,
  ChoiceButtons,
  Divider,
} from "./components";

export const arctavernLibrary = createLibrary({
  root: "UICard",
  components: [
    UICard,
    Text,
    Heading,
    ItemList,
    DataTable,
    CodeBlock,
    AlertBox,
    TagGroup,
    ChoiceButtons,
    Divider,
  ],
  componentGroups: [
    {
      name: "Layout",
      components: ["UICard", "Divider"],
      notes: ["UICard is always the root component."],
    },
    {
      name: "Content",
      components: ["Text", "Heading", "ItemList", "DataTable", "CodeBlock", "AlertBox", "TagGroup"],
    },
    {
      name: "Interactive",
      components: ["ChoiceButtons"],
      notes: ["ChoiceButtons sends the clicked label as a new user message."],
    },
  ],
});

const promptOptions: PromptOptions = {
  preamble:
    "When structured UI mode is enabled, respond with interactive UI components using OpenUI Lang. Every response must feel visually structured rather than plain text only.",
  additionalRules: [
    "Do not fall back to plain text only when structured UI mode is enabled.",
    "Always include at least one meaningful visual component, even for simple replies.",
    "ChoiceButtons alone is not enough; pair interactive choices with at least one content component such as Text, Heading, AlertBox, DataTable, CodeBlock, TagGroup, or Divider inside UICard.",
    "Keep component nesting shallow and purposeful.",
    "Use ChoiceButtons to offer interactive options the user can click.",
    "UICard should remain the root and should contain useful visible content, not an empty wrapper.",
  ],
  examples: [
    'root = UICard("Comparison", [Heading("Features"), DataTable(["Feature", "Plan A", "Plan B"], [["Storage", "10GB", "100GB"], ["Price", "$5/mo", "$15/mo"]])])',
  ],
};

let cachedPrompt: string | null = null;

export function getOpenUiSystemPrompt(): string {
  if (!cachedPrompt) {
    cachedPrompt = arctavernLibrary.prompt(promptOptions);
  }
  return cachedPrompt;
}
