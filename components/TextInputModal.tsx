import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';

interface TextInputModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function TextInputModal({
  visible,
  title,
  message,
  placeholder = 'Enter text...',
  initialValue = '',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
}: TextInputModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [text, setText] = useState(initialValue);

  // Reset text when modal opens/closes or initialValue changes
  useEffect(() => {
    if (visible) {
      setText(initialValue);
    }
  }, [visible, initialValue]);

  const handleConfirm = () => {
    onConfirm(text);
    setText(''); // Reset after confirm
  };

  const handleCancel = () => {
    onCancel();
    setText(''); // Reset after cancel
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
          <Text style={[styles.modalTitle, isDark && styles.darkText]}>
            {title}
          </Text>
          {message && (
            <Text style={[styles.modalMessage, isDark && styles.darkText]}>
              {message}
            </Text>
          )}
          <TextInput
            style={[styles.textInput, isDark && styles.darkTextInput]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={isDark ? '#666' : '#999'}
            autoFocus={true}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, isDark && styles.darkCancelButton]}
              onPress={handleCancel}
            >
              <Text style={[styles.cancelButtonText, isDark && styles.darkCancelButtonText]}>
                {cancelText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  darkText: {
    color: '#fff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  darkTextInput: {
    borderColor: '#444',
    backgroundColor: '#2c2c2e',
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  darkCancelButton: {
    backgroundColor: '#2c2c2e',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  darkCancelButtonText: {
    color: '#fff',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

