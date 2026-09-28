import type { Meta, StoryObj } from "@storybook/react"
import { Badge } from "./badge"

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
}
export default meta

type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: { children: "New" },
}

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
}
