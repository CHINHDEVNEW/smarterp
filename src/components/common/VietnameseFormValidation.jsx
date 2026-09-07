import { useEffect } from 'react'

function messageFor(control) {
  const { validity } = control

  if (validity.valueMissing) {
    if (control instanceof HTMLSelectElement) return 'Vui lòng chọn một mục.'
    if (control.type === 'checkbox' || control.type === 'radio') return 'Vui lòng chọn mục này.'
    if (control.type === 'file') return 'Vui lòng chọn tệp.'
    return 'Vui lòng nhập trường này.'
  }
  if (validity.typeMismatch) {
    return control.type === 'email'
      ? 'Vui lòng nhập địa chỉ email hợp lệ.'
      : 'Vui lòng nhập đúng định dạng.'
  }
  if (validity.badInput) return 'Vui lòng nhập một số hợp lệ.'
  if (validity.rangeUnderflow) return `Giá trị không được nhỏ hơn ${control.min}.`
  if (validity.rangeOverflow) return `Giá trị không được lớn hơn ${control.max}.`
  if (validity.stepMismatch) return 'Giá trị không đúng bước cho phép.'
  if (validity.tooShort) return `Vui lòng nhập ít nhất ${control.minLength} ký tự.`
  if (validity.tooLong) return `Vui lòng nhập không quá ${control.maxLength} ký tự.`
  if (validity.patternMismatch) return 'Thông tin chưa đúng định dạng yêu cầu.'
  return 'Thông tin chưa hợp lệ.'
}

function isFormControl(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  )
}

export default function VietnameseFormValidation() {
  useEffect(() => {
    function handleInvalid(event) {
      if (!isFormControl(event.target)) return
      event.target.setCustomValidity(messageFor(event.target))
    }

    function clearMessage(event) {
      if (!isFormControl(event.target)) return
      event.target.setCustomValidity('')
    }

    document.addEventListener('invalid', handleInvalid, true)
    document.addEventListener('input', clearMessage, true)
    document.addEventListener('change', clearMessage, true)
    return () => {
      document.removeEventListener('invalid', handleInvalid, true)
      document.removeEventListener('input', clearMessage, true)
      document.removeEventListener('change', clearMessage, true)
    }
  }, [])

  return null
}
