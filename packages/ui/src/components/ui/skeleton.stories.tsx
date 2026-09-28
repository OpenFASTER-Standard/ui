import type { Meta, StoryObj } from "@storybook/react"
import { Skeleton } from "./skeleton"

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
}
export default meta

type Story = StoryObj<typeof Skeleton>

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-32" />,
}
