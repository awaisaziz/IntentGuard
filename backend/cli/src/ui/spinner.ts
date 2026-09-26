import ora, { Ora } from 'ora';

/**
 * Creates and returns a configured spinner instance.
 * @param text The text to display with the spinner
 * @returns The ora spinner instance
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
  });
}

/**
 * Runs an asynchronous operation with a spinner.
 * @param text The text to display with the spinner
 * @param fn The asynchronous function to execute
 * @returns The result of the asynchronous function
 */
export async function withSpinner<T>(text: string, fn: () => Promise<T>): Promise<T> {
  const spinner = createSpinner(text).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail();
    throw err;
  }
}
