/** Source Feathers style-provider contract, specialized to its target control. */
export interface StyleProvider<T> {
  applyStyles(target: T): void;
}
