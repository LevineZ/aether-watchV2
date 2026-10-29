"""Qt dialogs for trial / activation."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
)

from licensekit import activate, machine_id, trial_status


class LicenseDialog(QDialog):
    def __init__(self, parent=None, *, blocking: bool = False):
        super().__init__(parent)
        self.setWindowTitle("RomesView 授权")
        self.setMinimumWidth(480)
        self._blocking = blocking

        st = trial_status()
        tip = QLabel(st.get("message") or "")
        tip.setWordWrap(True)

        mid = QLineEdit(machine_id())
        mid.setReadOnly(True)

        self.code = QTextEdit()
        self.code.setPlaceholderText("粘贴激活码（NCV1....）")
        self.code.setFixedHeight(80)

        form = QFormLayout()
        form.addRow("本机机器码", mid)
        form.addRow("激活码", self.code)

        copy_btn = QPushButton("复制机器码")
        copy_btn.clicked.connect(lambda: self._copy(mid.text()))

        buttons = QDialogButtonBox()
        self.btn_activate = buttons.addButton("激活", QDialogButtonBox.AcceptRole)
        if not blocking:
            buttons.addButton("继续试用", QDialogButtonBox.RejectRole)
        else:
            buttons.addButton("退出", QDialogButtonBox.RejectRole)
        buttons.accepted.connect(self._do_activate)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(tip)
        layout.addLayout(form)
        row = QHBoxLayout()
        row.addWidget(copy_btn)
        row.addStretch(1)
        layout.addLayout(row)
        layout.addWidget(buttons)

    def _copy(self, text: str):
        from PySide6.QtWidgets import QApplication

        QApplication.clipboard().setText(text)
        QMessageBox.information(self, "RomesView", "机器码已复制")

    def _do_activate(self):
        try:
            msg = activate(self.code.toPlainText())
        except ValueError as e:
            QMessageBox.critical(self, "激活失败", str(e))
            return
        QMessageBox.information(self, "激活成功", msg)
        self.accept()


def ensure_licensed(parent=None) -> bool:
    """Return True if app may start. Shows dialog when trial expired."""
    st = trial_status()
    if st.get("ok"):
        if st.get("mode") == "trial":
            # soft notice once per session — keep quiet for remain > 12h
            if int(st.get("remain_hours") or 0) <= 12:
                QMessageBox.information(parent, "试用提示", st.get("message") or "")
        return True

    dlg = LicenseDialog(parent, blocking=True)
    if dlg.exec() == QDialog.Accepted:
        st2 = trial_status()
        return bool(st2.get("ok"))
    return False
