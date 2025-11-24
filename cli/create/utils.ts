import { kebabCase } from "es-toolkit";

export const isKebabCase = (value: string) => {
	return kebabCase(value) === value;
};
