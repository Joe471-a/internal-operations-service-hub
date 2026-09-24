import { Department } from '../requests/requests.data';

/**
 * The hub's own words for what the classifier is allowed to answer.
 *
 * Reuses `Department` from the requests module rather than defining a
 * second vocabulary - there is one real list of departments, and this
 * contract can never drift from it.
 *
 * `department: null` is a real, allowed answer - it means the model was
 * given a chance to say "I cannot tell" instead of being forced to guess
 * one of the three. Text like "idk" / "idk" should end up here, not as a
 * confident but meaningless department.
 */
export interface ClassificationResult {
  department: Department | null;
}
