# 🎨 نظام مكوّنات نووريكس — UI Kit

مكتبة مكوّنات ذرية (Atomic Design) مبنية فوق CSS Variables الموجودة في `index.css`.  
**نقطة تحكم واحدة** — تعديل أي مكوّن هنا يؤثر في كامل النظام فوراً.

---

## 📦 الاستيراد

```jsx
import { Button, Input, Card, Badge, Modal, Spinner } from '../../ui';
```

---

## 🔘 Button

```jsx
// الأنواع
<Button>افتراضي</Button>
<Button variant="primary">أساسي</Button>
<Button variant="success">نجاح</Button>
<Button variant="danger">حذف</Button>
<Button variant="warning">تحذير</Button>
<Button variant="ghost">شبح</Button>

// الأحجام
<Button size="sm">صغير</Button>
<Button size="md">متوسط (افتراضي)</Button>
<Button size="lg">كبير</Button>

// حالات
<Button loading>جاري الحفظ...</Button>
<Button disabled>معطّل</Button>
<Button fullWidth>عرض كامل</Button>

// أيقونات
<Button icon="💾" variant="primary">حفظ</Button>
<Button iconEnd="→">التالي</Button>

// submit
<Button type="submit" variant="primary">إرسال النموذج</Button>
```

**Variants:** `default` | `primary` | `success` | `danger` | `warning` | `ghost`  
**Sizes:** `sm` | `md` | `lg`

---

## 📝 Input

```jsx
// نص
<Input label="اسم الموظف" value={name} onChange={e => setName(e.target.value)} required />

// رقم
<Input type="number" label="الراتب" prefix="SAR" />

// تاريخ
<Input type="date" label="تاريخ الميلاد" />

// قائمة منسدلة
<Input type="select" label="الحالة">
  <option value="">— اختر —</option>
  <option value="active">نشط</option>
  <option value="inactive">غير نشط</option>
</Input>

// متعدد الأسطر
<Input multiline label="ملاحظات" rows={4} />

// مع خطأ
<Input label="الاسم" error="الحقل مطلوب" />

// مع تلميح
<Input label="كلمة المرور" type="password" hint="8 أحرف على الأقل" />

// مع لاحقة
<Input type="number" label="النسبة" suffix="%" />
```

---

## 🃏 Card

```jsx
// بطاقة عامة
<Card>محتوى عام</Card>
<Card padding="lg">محتوى بهامش كبير</Card>

// بطاقة إدارية
<Card variant="exec"
  stripe="green"
  title="إجمالي الإيرادات"
  value="125,400 ﷼"
  icon="💰"
  footer="مقارنة بالشهر الماضي: +12%"
/>

// بطاقة إحصائية
<Card variant="stat"
  color="blue"
  label="الموظفون"
  value={42}
  icon="👥"
  delta={5}
/>
```

**Variants:** `surface` | `exec` | `stat` | `plain`  
**Padding:** `none` | `sm` | `md` | `lg`  
**Stripe/Color:** `green` | `blue` | `red` | `amber` | `violet` | `gray`

---

## 🏷️ Badge

```jsx
<Badge color="green">نشط</Badge>
<Badge color="red">محظور</Badge>
<Badge color="amber" dot>معلّق</Badge>
<Badge color="blue" size="sm">جديد</Badge>

// ربط تلقائي بالحالة
const STATUS_MAP = {
  pending:  { color: 'amber', label: 'معلّق' },
  approved: { color: 'green', label: 'موافق' },
  rejected: { color: 'red',   label: 'مرفوض' },
  active:   { color: 'green', label: 'نشط' },
  inactive: { color: 'gray',  label: 'غير نشط' },
};

<Badge {...Badge.fromStatus(row.status, STATUS_MAP)} />
```

**Colors:** `green` | `red` | `amber` | `blue` | `sky` | `violet` | `gray` | `navy`

---

## 🪟 Modal

```jsx
// أساسي
<Modal open={open} onClose={() => setOpen(false)} title="تعديل الموظف">
  <Input label="الاسم" ... />
</Modal>

// مع footer
<Modal
  open={confirmDelete}
  onClose={() => setConfirmDelete(false)}
  title="حذف العنصر"
  size="sm"
  footer={
    <>
      <Button variant="ghost" onClick={() => setConfirmDelete(false)}>إلغاء</Button>
      <Button variant="danger" onClick={handleDelete}>حذف</Button>
    </>
  }
>
  هل أنت متأكد من حذف هذا العنصر؟
</Modal>
```

**Sizes:** `sm` (400px) | `md` (560px) | `lg` (720px) | `xl` (900px) | `full`

---

## ⏳ Spinner

```jsx
<Spinner />
<Spinner size="sm" color="white" />
<Spinner size="lg" label="جاري التحميل..." />

// يملأ المنطقة
<Spinner.Page label="جاري تحميل البيانات..." />
```

**Sizes:** `xs` | `sm` | `md` | `lg`  
**Colors:** `primary` | `white` | `muted` | `inherit`

---

## ➖ Divider

```jsx
<Divider />
<Divider label="أو" />
<Divider vertical style={{ height: 24 }} />
```

---

## 📐 FormRow

```jsx
// صفان جنباً إلى جنب (يتحول لعمود على الجوال)
<FormRow>
  <Input label="الاسم الأول" />
  <Input label="الاسم الأخير" />
</FormRow>

// 3 أعمدة
<FormRow cols={3}>
  <Input label="المدينة" />
  <Input label="الدولة" />
  <Input label="الرمز البريدي" />
</FormRow>
```

---

## 🗂️ هيكل الملفات

```
src/ui/
├── index.js       ← نقطة الاستيراد المركزية
├── ui.css         ← جميع أنماط المكوّنات
├── Button.jsx
├── Input.jsx
├── Card.jsx
├── Badge.jsx
├── Modal.jsx
├── Spinner.jsx
├── Divider.jsx
├── FormRow.jsx
└── README.md
```

---

## 💡 خطة التبني التدريجي

عند تعديل أي شاشة جديدة، استبدل:

| قديم | جديد |
|------|------|
| `<button className="noorix-btn-primary">` | `<Button variant="primary">` |
| `<button className="noorix-btn-nav">` | `<Button>` |
| `<input style={{...inputStyle}}>` | `<Input label="...">` |
| `<div className="noorix-surface-card">` | `<Card>` |
| `<span style={{padding:'2px 8px', borderRadius:999, ...}}>` | `<Badge color="green">` |
| `<div style={{position:'fixed', inset:0, ...}}>` | `<Modal open={...}>` |
