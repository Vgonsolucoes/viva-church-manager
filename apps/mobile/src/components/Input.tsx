import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TextInputProps,
  Pressable,
  KeyboardTypeOptions,
  ViewStyle,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { theme } from "@/theme";

export interface InputProps extends Omit<TextInputProps, "onChangeText"> {
  label?: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  passwordToggle?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  errorMessage?: string;
  error?: string;
  containerStyle?: ViewStyle | ViewStyle[];
  wrapperStyle?: ViewStyle | ViewStyle[];
  inputStyle?: any;
  keyboardType?: KeyboardTypeOptions;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  passwordToggle,
  leftIcon,
  rightIcon,
  errorMessage,
  error,
  containerStyle,
  wrapperStyle,
  inputStyle,
  secureTextEntry,
  ...rest
}: InputProps) {
  const [showPwd, setShowPwd] = useState(false);
  const secure = secureTextEntry && !showPwd;
  const showPasswordToggle = passwordToggle || secureTextEntry;
  const errMsg = errorMessage || error;

  return (
    <View style={[styles.container, containerStyle, wrapperStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.wrap, !!errMsg && styles.wrapError]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.foregroundMuted}
          secureTextEntry={secure}
          style={[styles.input, leftIcon && { paddingLeft: 10 }, inputStyle]}
          cursorColor={theme.colors.primary400}
          selectionColor={theme.colors.primary400}
        />
        {showPasswordToggle ? (
          <Pressable
            style={({ pressed }) => [styles.rightIcon, pressed && { opacity: 0.6 }]}
            onPress={() => setShowPwd((s) => !s)}
            hitSlop={10}
          >
            {showPwd ? (
              <EyeOff size={18} color={theme.colors.foregroundMuted} />
            ) : (
              <Eye size={18} color={theme.colors.foregroundMuted} />
            )}
          </Pressable>
        ) : rightIcon ? (
          <View style={styles.rightIcon}>{rightIcon}</View>
        ) : null}
      </View>
      {errMsg ? <Text style={styles.errorText}>{errMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  label: {
    ...theme.typography.subtleBold,
    color: theme.colors.foregroundMuted,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  wrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.input,
    borderWidth: 0.6,
    borderColor: theme.colors.white16,
    minHeight: 52,
  },
  wrapError: { borderColor: theme.colors.danger500, borderWidth: 1 },
  leftIcon: { paddingHorizontal: theme.spacing.md },
  rightIcon: { paddingHorizontal: theme.spacing.md },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: theme.spacing.md,
    color: "#FFFFFF",
    ...theme.typography.body,
  },
  errorText: {
    marginTop: 6,
    ...theme.typography.caption,
    color: theme.colors.danger500,
  },
});
