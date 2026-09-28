import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "./input"

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
}
export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: { placeholder: "Fact key" },
}

export const Disabled: Story = {
  args: { placeholder: "Fact key", disabled: true },
}
