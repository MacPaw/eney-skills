import Foundation
import UIX

// MARK: - Password Generation

private let lowercaseLetters = "abcdefghijklmnopqrstuvwxyz"
private let uppercaseLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
private let digits = "0123456789"
private let symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?"

// MARK: - NewPassword Widget

struct NewPasswordWidget: Widget {
    private let initialLength: Int
    private let initialSymbols: Bool
    private let initialNumbers: Bool

    init(properties: [String: PropertyValue] = [:]) {
        self.initialLength = properties["length"]?.intValue ?? 20
        self.initialSymbols = properties["symbols"]?.boolValue ?? true
        self.initialNumbers = properties["numbers"]?.boolValue ?? true
    }

    func body(_ ctx: Context) -> some ComponentProtocol {
        let length = ctx.state(initialLength)
        let includeSymbols = ctx.state(initialSymbols)
        let includeNumbers = ctx.state(initialNumbers)
        let password = ctx.state(
            generatePassword(
                length: length.value,
                includeNumbers: includeNumbers.value,
                includeSymbols: includeSymbols.value
            )
        )

        let actions = ActionPanel(layout: .row) {
            Action(title: "Generate", style: .secondary) {
                password.value = generatePassword(
                    length: length.value,
                    includeNumbers: includeNumbers.value,
                    includeSymbols: includeSymbols.value
                )
            }
            Action(title: "Done", style: .primary) {
                ctx.closeWidget(context: "Generated password: \(password.value)")
            }
        }

        return Form(actions: actions) {
            NumberField(
                name: "length",
                value: Double(length.value),
                label: "Password length (max 128)",
                max: 128,
                onChange: { val in
                    length.value = Int(val ?? 20)
                    password.value = generatePassword(
                        length: Int(val ?? 20),
                        includeNumbers: includeNumbers.value,
                        includeSymbols: includeSymbols.value
                    )
                }
            )
            Checkbox(
                name: "symbols",
                label: "Include special characters",
                checked: includeSymbols.value,
                variant: .switch,
                onChange: { val in
                    includeSymbols.value = val
                    password.value = generatePassword(
                        length: length.value,
                        includeNumbers: includeNumbers.value,
                        includeSymbols: val
                    )
                }
            )
            Checkbox(
                name: "numbers",
                label: "Include numbers",
                checked: includeNumbers.value,
                variant: .switch,
                onChange: { val in
                    includeNumbers.value = val
                    password.value = generatePassword(
                        length: length.value,
                        includeNumbers: val,
                        includeSymbols: includeSymbols.value
                    )
                }
            )
            TextField(
                name: "password",
                value: password.value,
                isCopyable: true,
                onChange: { val in
                    password.value = val
                }
            )
        }
    }
}

extension NewPasswordWidget {
    enum Constants {
        static let lowercaseLetters = "abcdefghijklmnopqrstuvwxyz"
        static let uppercaseLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        static let digits = "0123456789"
        static let symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?"
    }

    private func generatePassword(
            length: Int,
            includeNumbers: Bool,
            includeSymbols: Bool
        ) -> String {
            var charset = Constants.lowercaseLetters + Constants.uppercaseLetters
            if includeNumbers { charset += Constants.digits }
            if includeSymbols { charset += Constants.symbols }
            let chars = Array(charset)
            guard !chars.isEmpty, length > 0 else { return "" }
            return String(
                (0..<min(length, 128)).map { _ in chars[Int.random(in: 0..<chars.count)] })
        }
}

// MARK: - Widget Definition

let newPasswordDefinition = defineWidget(
    name: "new-password-swift",
    description: "Generate a new password",
    schema: InputSchema {
        InputSchema.Field(
            name: "length", type: .number, description: "The length of the password to generate.")
        InputSchema.Field(
            name: "symbols", type: .boolean, description: "Whether to include special characters.")
        InputSchema.Field(
            name: "numbers", type: .boolean, description: "Whether to include numbers.")
    },
    factory: { props in NewPasswordWidget(properties: props) }
)
