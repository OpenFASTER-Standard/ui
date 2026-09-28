import type { Meta, StoryObj } from "@storybook/react"
import { Textarea } from "./textarea"

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
}
export default meta

type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: { placeholder: "Reasoning" },
}

export const Disabled: Story = {
  args: { placeholder: "Reasoning", disabled: true },
}

export const Invalid: Story = {
  args: { placeholder: "Reasoning", "aria-invalid": true },
}
