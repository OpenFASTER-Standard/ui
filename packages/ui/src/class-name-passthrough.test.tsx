import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { Button } from "./components/ui/button"
import { Badge } from "./components/ui/badge"
import { Input } from "./components/ui/input"
import { Checkbox } from "./components/ui/checkbox"
import { Label } from "./components/ui/label"
import { Textarea } from "./components/ui/textarea"
import { Skeleton } from "./components/ui/skeleton"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./components/ui/card"
import { Alert, AlertTitle, AlertDescription, AlertAction } from "./components/ui/alert"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./components/ui/accordion"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./components/ui/table"
import { DialogHeader, DialogFooter } from "./components/ui/dialog"

const MARKER = "test-passthrough-marker"

// Every component in the library implements the same contract: cn(<base
// classes>, className) lands on the element carrying that component's own
// data-slot. Nothing previously asserted this -- AccordionContent silently
// broke it (className landed on a slot-less inner div instead of the
// data-slot="accordion-content" element itself, see accordion.tsx) and the
// full suite stayed green, because no test exercised className at all.
//
// Scoped to components that render standalone without extra provider
// context: Dialog's Title/Description/Content and Form's Item/Label/
// Control/Description/Message need their own primitive's open/field
// context to render at all, and already have their own per-file tests
// (dialog.test.tsx, form.test.tsx) -- this file complements those rather
// than duplicating their setup.
const CASES: Array<[name: string, dataSlot: string, render: () => ReturnType<typeof render>]> = [
  ["Button", "button", () => render(<Button className={MARKER}>x</Button>)],
  ["Badge", "badge", () => render(<Badge className={MARKER}>x</Badge>)],
  ["Input", "input", () => render(<Input className={MARKER} />)],
  ["Checkbox", "checkbox", () => render(<Checkbox className={MARKER} />)],
  ["Label", "label", () => render(<Label className={MARKER}>x</Label>)],
  ["Textarea", "textarea", () => render(<Textarea className={MARKER} />)],
  ["Skeleton", "skeleton", () => render(<Skeleton className={MARKER} />)],
  ["Card", "card", () => render(<Card className={MARKER} />)],
  ["CardHeader", "card-header", () => render(<CardHeader className={MARKER} />)],
  ["CardTitle", "card-title", () => render(<CardTitle className={MARKER} />)],
  ["CardDescription", "card-description", () => render(<CardDescription className={MARKER} />)],
  ["CardAction", "card-action", () => render(<CardAction className={MARKER} />)],
  ["CardContent", "card-content", () => render(<CardContent className={MARKER} />)],
  ["CardFooter", "card-footer", () => render(<CardFooter className={MARKER} />)],
  ["Alert", "alert", () => render(<Alert className={MARKER} />)],
  ["AlertTitle", "alert-title", () => render(<AlertTitle className={MARKER} />)],
  ["AlertDescription", "alert-description", () => render(<AlertDescription className={MARKER} />)],
  ["AlertAction", "alert-action", () => render(<AlertAction className={MARKER} />)],
  ["DialogHeader", "dialog-header", () => render(<DialogHeader className={MARKER} />)],
  ["DialogFooter", "dialog-footer", () => render(<DialogFooter className={MARKER} />)],
  [
    "Table",
    "table",
    () => render(<Table className={MARKER} />),
  ],
  [
    "TableHeader",
    "table-header",
    () => render(<table><TableHeader className={MARKER} /></table>),
  ],
  [
    "TableBody",
    "table-body",
    () => render(<table><TableBody className={MARKER} /></table>),
  ],
  [
    "TableFooter",
    "table-footer",
    () => render(<table><TableFooter className={MARKER} /></table>),
  ],
  [
    "TableRow",
    "table-row",
    () => render(<table><tbody><TableRow className={MARKER} /></tbody></table>),
  ],
  [
    "TableHead",
    "table-head",
    () => render(<table><thead><tr><TableHead className={MARKER} /></tr></thead></table>),
  ],
  [
    "TableCell",
    "table-cell",
    () => render(<table><tbody><tr><TableCell className={MARKER} /></tr></tbody></table>),
  ],
  [
    "TableCaption",
    "table-caption",
    () => render(<table><TableCaption className={MARKER} /></table>),
  ],
  [
    "Accordion",
    "accordion",
    () => render(<Accordion className={MARKER} />),
  ],
  [
    "AccordionItem",
    "accordion-item",
    () => render(
      <Accordion>
        <AccordionItem value="a" className={MARKER} />
      </Accordion>
    ),
  ],
  [
    "AccordionTrigger",
    "accordion-trigger",
    () => render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger className={MARKER}>x</AccordionTrigger>
        </AccordionItem>
      </Accordion>
    ),
  ],
  [
    "AccordionContent",
    "accordion-content",
    () => render(
      <Accordion defaultValue={["a"]}>
        <AccordionItem value="a">
          <AccordionTrigger>x</AccordionTrigger>
          <AccordionContent className={MARKER}>x</AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
  ],
]

describe("every standalone component merges a passed className onto its own data-slot element", () => {
  it.each(CASES)("%s (data-slot=%s)", (_name, dataSlot, doRender) => {
    const { container } = doRender()
    const el = container.querySelector(`[data-slot="${dataSlot}"]`)
    expect(el, `no element with data-slot="${dataSlot}" was rendered at all`).not.toBeNull()
    expect(el?.className.split(/\s+/)).toContain(MARKER)
  })
})
