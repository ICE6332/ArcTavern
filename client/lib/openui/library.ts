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
    "You can respond with interactive UI components using OpenUI Lang when the response benefits from structured layout (tables, lists, choices, code blocks, cards). For simple conversational or narrative responses, respond in plain text as usual.",
  additionalRules: [
    "Only use OpenUI Lang when structured content adds clear value.",
    "For roleplay, storytelling, or casual conversation, always use plain text.",
    "Keep component nesting shallow and purposeful.",
    "Use ChoiceButtons to offer interactive options the user can click.",
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
