import Foundation
import UIX

struct SetTimerWidget: Widget {
    let initialMinutes: Int

    init(properties: [String: PropertyValue] = [:]) {
        self.initialMinutes = properties["minutes"]?.intValue ?? 5
    }

    func body(_ ctx: Context) -> some ComponentProtocol {
        let remainingSeconds = ctx.state(initialMinutes * 60)
        let isRunning = ctx.state(true)
        let mins = remainingSeconds.value / 60
        let secs = remainingSeconds.value % 60
        let timeString = String(format: "%02d:%02d", mins, secs)

        // Auto-start the countdown using ctx.task for proper re-rendering
        ctx.task(id: "countdown") { rerender in
            while remainingSeconds.value > 0 && isRunning.value {
                try await Task.sleep(for: .seconds(1))
                if isRunning.value {
                    remainingSeconds.value -= 1
                    await rerender()
                }
            }
            if remainingSeconds.value == 0 {
                isRunning.value = false
                await rerender()
            }
        }

        // Timer finished
        if !isRunning.value && remainingSeconds.value == 0 {
            return Form(actions: ActionPanel(layout: .row) {
                Action(title: "Done", style: .primary) {
                    ctx.closeWidget(context: "Timer completed! \(initialMinutes) minute(s) elapsed.")
                }
            }) {
                Text("Timer set for \(initialMinutes) minute(s)")
                Text("00:00 — Time's up!")
            }
        }

        // Timer running
        return Form(actions: ActionPanel(layout: .row) {
            Action(title: "Stop", style: .primary) {
                isRunning.value = false
                ctx.closeWidget(context: "Timer stopped at \(timeString) remaining")
            }
            Action(title: "Cancel", style: .secondary) {
                isRunning.value = false
                ctx.closeWidget(context: "Timer cancelled")
            }
        }) {
            NumberField(
                name: "minutes",
                value: Double(initialMinutes),
                label: "Timer (minutes)",
                min: 1,
                max: 1440
            )
            Text(timeString)
        }
    }
}

// MARK: - Widget Definition

let setTimerDefinition = defineWidget(
    name: "set-timer",
    description: "Set a countdown timer for a specified number of minutes",
    schema: InputSchema {
        InputSchema.Field(
            name: "minutes", type: .number,
            description: "The time in minutes for the countdown timer")
    },
    factory: { props in SetTimerWidget(properties: props) }
)
