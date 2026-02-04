import * as kolor from "kolorist";

export { kolor };

export function logError(message: string): void {
  console.error(kolor.red(message));
}

export function logWarning(message: string): void {
  console.log(kolor.yellow(message));
}

export function logSuccess(message: string): void {
  console.log(kolor.green(message));
}

export function logInfo(message: string): void {
  console.log(kolor.cyan(message));
}

export function logDim(message: string): void {
  console.log(kolor.dim(message));
}

export function logBold(message: string): void {
  console.log(kolor.bold(message));
}
