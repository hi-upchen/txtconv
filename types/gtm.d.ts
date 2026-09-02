/**
 * GTM dataLayer TypeScript Definitions
 * Provides type safety for Google Tag Manager tracking events
 */

export interface FileConversionStartedEvent {
  event: 'file_conversion_started';
  file_size: number;
  file_type: string;
  file_name: string;
  input_encoding: string;
}

export interface FileConversionCompletedEvent {
  event: 'file_conversion_completed';
  file_size: number;
  file_type: string;
  conversion_duration_ms: number;
  input_encoding: string;
  output_encoding: string;
}

export interface FileConversionFailedEvent {
  event: 'file_conversion_failed';
  file_size: number;
  file_type: string;
  error_type: 'encoding_error' | 'processing_error' | 'timeout';
  error_message: string;
  input_encoding: string;
}

export interface FileRejectedEvent {
  event: 'file_rejected';
  file_size: number;
  file_type: string;
  /** Machine-readable rejection cause from the file validator */
  reject_reason: 'size_limit_free' | 'size_limit_pro' | 'blocked_type' | 'empty';
  /** True when a larger paid plan would have accepted the file */
  upgrade_available: boolean;
  /** Page path where the rejection happened (e.g. "/", "/srt") */
  source_path: string;
}

export interface BeginCheckoutEvent {
  event: 'begin_checkout';
  currency: string;
  value: number;
  item_name: string;
  /** Page path where the buy button was clicked (e.g. "/", "/srt") */
  source_path: string;
}

export interface UpgradeCtaClickedEvent {
  event: 'upgrade_cta_clicked';
  /** Which limit triggered the CTA the user clicked */
  cta_source: 'file_size_limit' | 'dict_limit';
  source_path: string;
}

/** How the user signed in. Also the value of the login_just_succeeded cookie. */
export type LoginMethod = 'google' | 'email_code' | 'magic_link';

export interface LoginStartedEvent {
  event: 'login_started';
  method: LoginMethod;
  /** Page path where the login panel was opened (e.g. "/", "/checkout") */
  source_path: string;
}

export interface LoginSucceededEvent {
  event: 'login_succeeded';
  method: LoginMethod;
  /** Page path where success was observed */
  source_path: string;
}

export interface LoginFailedEvent {
  event: 'login_failed';
  method: LoginMethod;
  /** Machine-readable cause, e.g. Supabase error code or "link_invalid_or_expired" */
  reason: string;
}

export type DataLayerEvent =
  | FileConversionStartedEvent
  | FileConversionCompletedEvent
  | FileConversionFailedEvent
  | FileRejectedEvent
  | BeginCheckoutEvent
  | UpgradeCtaClickedEvent
  | LoginStartedEvent
  | LoginSucceededEvent
  | LoginFailedEvent;

declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
  }
}
