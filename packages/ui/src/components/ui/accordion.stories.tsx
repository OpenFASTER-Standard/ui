import type { Meta, StoryObj } from "@storybook/react"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion"

const meta: Meta<typeof Accordion> = {
  title: "UI/Accordion",
  component: Accordion,
}
export default meta
type Story = StoryObj<typeof Accordion>

export const Default: Story = {
  render: () => (
    <Accordion>
      <AccordionItem value="a">
        <AccordionTrigger>MiKaDiv_FM_Meldeart23</AccordionTrigger>
        <AccordionContent>5 candidates</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>MiKaDiv_FM_Personentypen</AccordionTrigger>
        <AccordionContent>127 candidates</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

export const DefaultOpen: Story = {
  render: () => (
    <Accordion defaultValue={["a"]}>
      <AccordionItem value="a">
        <AccordionTrigger>MiKaDiv_FM_Meldeart23</AccordionTrigger>
        <AccordionContent>5 candidates</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>MiKaDiv_FM_Personentypen</AccordionTrigger>
        <AccordionContent>127 candidates</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

export const OpenMultiple: Story = {
  render: () => (
    <Accordion multiple defaultValue={["a", "b"]}>
      <AccordionItem value="a">
        <AccordionTrigger>MiKaDiv_FM_Meldeart23</AccordionTrigger>
        <AccordionContent>5 candidates</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>MiKaDiv_FM_Personentypen</AccordionTrigger>
        <AccordionContent>127 candidates</AccordionContent>
      </AccordionItem>
      <AccordionItem value="c">
        <AccordionTrigger>MiKaDiv_FM_Fachtypen</AccordionTrigger>
        <AccordionContent>85 candidates</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}
