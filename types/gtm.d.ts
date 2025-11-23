/**
 * GTM dataLayer TypeScript Definitions
 * Provides type safety for Google Tag Manager tracking events
 */

export interface FileUploadStartedEvent {
  event: 'file_upload_started';
  file_size: number;
  file_type: string;
  file_name: string;
  upload_method: 'drag_drop' | 'click_select';
}

export interface FileUploadCompletedEvent {
  event: 'file_upload_completed';
  file_size: number;
  file_type: string;
  file_name: string;
  upload_duration_ms: number;
}

export interface FileUploadFailedEvent {
  event: 'file_upload_failed';
  file_size: number;
  file_type: string;
  error_type: 'validation_error' | 'network_error' | 'size_limit' | 'type_not_allowed';
  error_message: string;
}

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

export type DataLayerEvent =
  | FileUploadStartedEvent
  | FileUploadCompletedEvent
  | FileUploadFailedEvent
  | FileConversionStartedEvent
  | FileConversionCompletedEvent
  | FileConversionFailedEvent;

declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
  }
}
