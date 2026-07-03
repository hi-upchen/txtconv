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

export type DataLayerEvent =
  | FileConversionStartedEvent
  | FileConversionCompletedEvent
  | FileConversionFailedEvent
  | BeginCheckoutEvent
  | UpgradeCtaClickedEvent;

declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
  }
}
