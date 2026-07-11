/**
 * Where the visitor's body currently is (WORK ORDER 0022).
 * A tiny shared truth so behaviors can coordinate without coupling:
 * the step behavior writes it, the look behavior reads it.
 */
export const visitorState = {
  /** True once the walk and settle have completed. */
  atWorking: false,
};
