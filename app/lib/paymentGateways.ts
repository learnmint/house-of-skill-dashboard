import Razorpay from 'razorpay';
import crypto from 'crypto';

// Payment gateway interface
export interface PaymentData {
  payment_link_id: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  description: string;
  gateway_link_id?: string | null;
  brand_name?: string;
  primary_color?: string;
}

export interface PaymentResponse {
  success: boolean;
  order_id?: string;
  gateway_data?: any;
  error?: string;
}

export interface VerificationData {
  payment_link_id: string;
  gateway_response: any;
}

export interface VerificationResponse {
  success: boolean;
  payment_id?: string;
  error?: string;
}

export interface PaymentGateway {
  name: string;
  initializePayment(data: PaymentData): Promise<PaymentResponse>;
  verifyPayment(data: VerificationData): Promise<VerificationResponse>;
}

// Razorpay Gateway Implementation
class RazorpayGateway implements PaymentGateway {
  name = 'razorpay';

  async initializePayment(data: PaymentData): Promise<PaymentResponse> {
    try {
      const razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
      });

      const options = {
        amount: Math.round(data.amount * 100), // Convert to paise
        currency: data.currency,
        receipt: `receipt_${data.payment_link_id}`,
        notes: {
          customer_name: data.customer_name,
          customer_email: data.customer_email || '',
          customer_phone: data.customer_phone,
          description: data.description,
        },
      };

      const order = await razorpayInstance.orders.create(options);

      return {
        success: true,
        order_id: order.id,
        gateway_data: {
          key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          amount: order.amount,
          currency: order.currency,
          order_id: order.id,
          name: data.brand_name || 'Course Payment',
          description: data.description,
          prefill: {
            name: data.customer_name,
            email: data.customer_email || '',
            contact: data.customer_phone,
          },
          theme: {
            color: data.primary_color || '#0066cc',
          },
        },
      };
    } catch (error: any) {
      console.error('Razorpay initialization error:', error);
      return {
        success: false,
        error: error.message || 'Failed to initialize Razorpay',
      };
    }
  }

  async verifyPayment(data: VerificationData): Promise<VerificationResponse> {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = data.gateway_response;

      // Verify signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest('hex');

      const isAuthentic = expectedSignature === razorpay_signature;

      if (isAuthentic) {
        return {
          success: true,
          payment_id: razorpay_payment_id,
        };
      } else {
        return {
          success: false,
          error: 'Payment verification failed',
        };
      }
    } catch (error: any) {
      console.error('Razorpay verification error:', error);
      return {
        success: false,
        error: error.message || 'Verification failed',
      };
    }
  }
}

// Cashfree Gateway (stub for future implementation)
class CashfreeGateway implements PaymentGateway {
  name = 'cashfree';

  async initializePayment(data: PaymentData): Promise<PaymentResponse> {
    return {
      success: false,
      error: 'Cashfree integration not implemented yet',
    };
  }

  async verifyPayment(data: VerificationData): Promise<VerificationResponse> {
    return {
      success: false,
      error: 'Cashfree integration not implemented yet',
    };
  }
}

// PhonePe Gateway (stub for future implementation)
class PhonePeGateway implements PaymentGateway {
  name = 'phonepe';

  async initializePayment(data: PaymentData): Promise<PaymentResponse> {
    return {
      success: false,
      error: 'PhonePe integration not implemented yet',
    };
  }

  async verifyPayment(data: VerificationData): Promise<VerificationResponse> {
    return {
      success: false,
      error: 'PhonePe integration not implemented yet',
    };
  }
}

// Gateway factory function
export function getPaymentGateway(gateway: string): PaymentGateway {
  switch (gateway.toLowerCase()) {
    case 'razorpay':
      return new RazorpayGateway();
    case 'cashfree':
      return new CashfreeGateway();
    case 'phonepe':
      return new PhonePeGateway();
    default:
      throw new Error(`Unsupported payment gateway: ${gateway}`);
  }
}
