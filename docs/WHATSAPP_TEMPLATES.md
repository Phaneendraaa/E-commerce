# WhatsApp setup & message templates

The store sends WhatsApp messages through the **Meta WhatsApp Cloud API**. Business-initiated messages
(order updates, tracking reminders, cart recovery) must use **templates approved by Meta**. Create the
templates below in **WhatsApp Manager → Message templates** with *exactly* these names and the same
number of `{{n}}` variables, in the same order. The wording can be changed freely.

Until a template is approved (or while `WHATSAPP_PROVIDER=console`), messages are logged in
**Admin → Messaging** as *not configured* and printed to the API console, so nothing breaks.

## 1. Connect the API

1. Create an app at <https://developers.facebook.com> → add the **WhatsApp** product.
2. Add a phone number (or use the test number) and copy its **Phone number ID**.
3. Create a **permanent access token** (Business Settings → System users → generate token with
   `whatsapp_business_messaging` and `whatsapp_business_management`).
4. In `backend/.env`:

   ```env
   WHATSAPP_PROVIDER=meta
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   WHATSAPP_ACCESS_TOKEN=EAAG...
   WHATSAPP_TEMPLATE_LANG=en
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=any-random-string
   WHATSAPP_APP_SECRET=your-app-secret   # optional, enforces webhook signatures
   ```

5. **Webhook** (App → WhatsApp → Configuration): callback URL `https://YOUR_API/api/webhooks/whatsapp`,
   verify token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, subscribe to the **messages** field.
   This enables delivery/read receipts, the **TRACK** auto-reply and **STOP/START** opt-out.

## 2. Templates to create

Category **Utility** unless noted. `{{1}}` is usually the customer's first name.

| Template name | Variables | Suggested body |
|---|---|---|
| `otp_code` *(Authentication)* | `{{1}}` code | Use Meta's authentication template with a *Copy code* button. |
| `welcome_message` *(Marketing)* | name, store | Welcome to {{2}}, {{1}}! Enjoy 10% off your first order with code WELCOME10. |
| `order_confirmed` | name, order no., total | Hi {{1}}, your order {{2}} for {{3}} is confirmed! We'll let you know when it ships. — Button: *Visit website* → `https://yourstore.com/{{1}}` |
| `payment_pending` | name, order no., total | Hi {{1}}, your order {{2}} ({{3}}) is waiting for payment. Complete it before items sell out. — URL button as above |
| `order_shipped` | name, order no., courier, AWB, tracking link | Good news {{1}}! Order {{2}} has shipped via {{3}}. Tracking ID: {{4}}. Track it here: {{5}} |
| `tracking_reminder` | name, order no., courier, AWB, tracking link | Hi {{1}}, your order {{2}} is on its way with {{3}} (ID {{4}}). Track the latest status: {{5}} |
| `out_for_delivery` | name, order no., note | Hi {{1}}, your order {{2}} is out for delivery today! {{3}} |
| `order_delivered` | name, order no. | Hi {{1}}, order {{2}} has been delivered. We hope you love it! Reply if anything isn't right. |
| `review_request` *(Marketing)* | name, product | Hi {{1}}, how are you liking your {{2}}? Share a quick review and earn bonus points. — URL button |
| `order_cancelled` | name, order no. | Hi {{1}}, your order {{2}} has been cancelled. Any payment made will be refunded in 5–7 business days. |
| `abandoned_cart` *(Marketing)* | name, item count, value | Hi {{1}}, you left {{2}} item(s) worth {{3}} in your cart. Complete your order before they sell out! — URL button → `https://yourstore.com/{{1}}` |
| `back_in_stock` *(Marketing)* | product | Good news! {{1}} is back in stock. Grab it before it's gone. — URL button |
| `return_update` | name, order no., status | Hi {{1}}, your return request for order {{2}} is now {{3}}. |
| `refund_processed` | name, amount, order no. | Hi {{1}}, a refund of {{2}} for order {{3}} has been processed. It can take 5–7 business days to reflect. |
| `custom_update` | name, message | Hi {{1}}, {{2}} — used for broadcasts and custom messages from the admin panel. |

### URL buttons
For templates marked *URL button*, add a **Visit website** button with a *dynamic* URL
`https://yourstore.com/{{1}}`. The API fills the suffix (e.g. `account/orders/SN2610201234` or `cart`).

## 3. How tracking reminders work

Courier tracking is done by the courier (Delhivery, Blue Dart, Shiprocket…). The store only stores the
**courier name, AWB and tracking link** that you enter when you click **Ship order**, then:

1. Immediately sends **order_shipped** on WhatsApp + SMS + email.
2. After `trackingReminderHours` (default 48h) sends **tracking_reminder**, repeating every 48h
   (max 3) while the order is still *Shipped*.
3. If the expected delivery date passes and it's still in transit, sends a follow-up.
4. **out_for_delivery** when you mark it so; reminders stop once it's *Delivered*.
5. A **review_request** goes out `reviewRequestDelayDays` after delivery.

Customers can also message **TRACK** to your WhatsApp number any time to get their latest order
status and tracking link (needs the webhook from step 1.5).

## 4. 24-hour window

Free-form messages from **Admin → Order → Message customer** (WhatsApp only) are delivered only
within 24 hours of the customer's last message to you. Outside that window, select another channel
too — the store will then use the approved `custom_update` template.
